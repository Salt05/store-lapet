// src/services/vnpay.service.ts
import crypto from 'node:crypto';
import { query, getPgPool } from '@/lib/db';
import { inventoryStorageService } from './inventory-storage.service';

export interface VnPayPaymentUrlParams {
  ipAddress: string;
  orderCode: string;
  amount: number;
  orderInfo?: string;
  returnUrl?: string;
}

export interface VnPayCallbackValidationResult {
  isValid: boolean;
  orderCode: string;
  responseCode: string;
  transactionStatus: string;
  transactionNo: string;
  amount: number;
  bankCode: string;
  payDate: string;
  isSuccess: boolean;
}

export class VnPayService {
  private runtimeConfig: { url?: string; tmn_code?: string; hash_secret?: string; return_url?: string } | null = null;
  private runtimeConfigExpiresAt: number = 0;

  private async loadConfig(): Promise<{ url: string; tmn_code: string; hash_secret: string; return_url: string }> {
    const now = Date.now();
    if (this.runtimeConfig && this.runtimeConfigExpiresAt > now) {
      return {
        url: this.runtimeConfig.url || this.getEnvSetting('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
        tmn_code: this.runtimeConfig.tmn_code || this.getEnvSetting('VNPAY_TMN_CODE', 'BPFUA1FN'),
        hash_secret: this.runtimeConfig.hash_secret || this.getEnvSetting('VNPAY_HASH_SECRET', 'RTPQJQXHOGYLLQWDCXNRHYVKAIXNHOZU'),
        return_url: this.runtimeConfig.return_url || this.getEnvSetting('VNPAY_RETURN_URL', 'http://localhost:4321/api/payment/vnpay-callback'),
      };
    }

    try {
      const pool = getPgPool();
      const res = await pool.query("SELECT value_plain FROM app_settings WHERE setting_key = 'vnpay_config' LIMIT 1;");
      if (res.rows.length > 0 && res.rows[0].value_plain) {
        const parsed = typeof res.rows[0].value_plain === 'string' ? JSON.parse(res.rows[0].value_plain) : res.rows[0].value_plain;
        this.runtimeConfig = parsed;
        this.runtimeConfigExpiresAt = now + 30000; // cache 30s
      }
    } catch {
      // fallback to env
    }

    return {
      url: (this.runtimeConfig?.url && this.runtimeConfig.url.trim()) || this.getEnvSetting('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
      tmn_code: (this.runtimeConfig?.tmn_code && this.runtimeConfig.tmn_code.trim()) || this.getEnvSetting('VNPAY_TMN_CODE', 'BPFUA1FN'),
      hash_secret: (this.runtimeConfig?.hash_secret && this.runtimeConfig.hash_secret.trim() && !this.runtimeConfig.hash_secret.includes('••••')) ? this.runtimeConfig.hash_secret.trim() : this.getEnvSetting('VNPAY_HASH_SECRET', 'RTPQJQXHOGYLLQWDCXNRHYVKAIXNHOZU'),
      return_url: (this.runtimeConfig?.return_url && this.runtimeConfig.return_url.trim()) || this.getEnvSetting('VNPAY_RETURN_URL', 'http://localhost:4321/api/payment/vnpay-callback'),
    };
  }

  private getEnvSetting(key: string, defaultValue: string = ''): string {
    const envKey = key.toUpperCase().replace(/[:.]/g, '_');
    return process.env[envKey] || (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env[envKey] : '') || defaultValue;
  }

  public async getVnpayUrl(): Promise<string> {
    const cfg = await this.loadConfig();
    return cfg.url;
  }

  public async getTmnCode(): Promise<string> {
    const cfg = await this.loadConfig();
    return cfg.tmn_code;
  }

  public async getHashSecret(): Promise<string> {
    const cfg = await this.loadConfig();
    return cfg.hash_secret;
  }

  /**
   * Tạo URL thanh toán VNPay chuẩn spec 2.1.0
   */
  public async createPaymentUrl(params: VnPayPaymentUrlParams): Promise<string> {
    const cfg = await this.loadConfig();
    const vnpayUrl = cfg.url;
    const tmnCode = cfg.tmn_code;
    const hashSecret = cfg.hash_secret;

    if (!tmnCode || !hashSecret) {
      throw new Error('Chưa cấu hình VNPAY_TMN_CODE hoặc VNPAY_HASH_SECRET.');
    }

    const vnpParams: Record<string, string> = {};

    vnpParams['vnp_Version'] = '2.1.0';
    vnpParams['vnp_Command'] = 'pay';
    vnpParams['vnp_TmnCode'] = tmnCode;

    // Số tiền nhân 100 theo quy định VNPay
    const rawAmount = Math.round(Number(params.amount) * 100).toString();
    vnpParams['vnp_Amount'] = rawAmount;

    // Thời gian tạo giao dịch định dạng GMT+7 yyyyMMddHHmmss
    vnpParams['vnp_CreateDate'] = this.getVnpayCreateDate();
    vnpParams['vnp_CurrCode'] = 'VND';

    let ip = params.ipAddress || '127.0.0.1';
    if (ip.includes(':') || ip.length > 15) {
      // VNPay chỉ nhận IPv4 <= 15 ký tự
      ip = '127.0.0.1';
    }
    vnpParams['vnp_IpAddr'] = ip;
    vnpParams['vnp_Locale'] = 'vn';

    const cleanCode = this.removeVietnameseSign(params.orderCode).replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanInfo = params.orderInfo
      ? this.removeVietnameseSign(params.orderInfo).replace(/[^a-zA-Z0-9_\- ]/g, '')
      : `Thanh toan don hang ${cleanCode}`;
    vnpParams['vnp_OrderInfo'] = cleanInfo.slice(0, 255);
    vnpParams['vnp_OrderType'] = 'other';

    const returnUrl = params.returnUrl || cfg.return_url || this.getEnvSetting('VNPAY_RETURN_URL', 'http://localhost:4321/api/payment/vnpay-callback');
    vnpParams['vnp_ReturnUrl'] = returnUrl;

    // Mã tham chiếu giao dịch độc nhất: orderCode-timestamp
    vnpParams['vnp_TxnRef'] = `${params.orderCode}-${Date.now()}`;

    // Sắp xếp theo thứ tự alphabet
    const sorted = this.sortObject(vnpParams);
    const signData = Object.entries(sorted)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return `${vnpayUrl}?${signData}&vnp_SecureHash=${secureHash}`;
  }

  /**
   * Kiểm tra tính toàn vẹn chữ ký và trích xuất dữ liệu trả về từ VNPay
   */
  public async parseAndValidateCallback(queryParameters: Record<string, string>): Promise<VnPayCallbackValidationResult> {
    const hashSecret = await this.getHashSecret();
    const secureHash = queryParameters['vnp_SecureHash'] || queryParameters['vnp_securehash'] || '';

    const vnpParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParameters)) {
      if (key.startsWith('vnp_') && key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
        vnpParams[key] = value;
      }
    }

    const sorted = this.sortObject(vnpParams);
    const signData = Object.entries(sorted)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = Boolean(secureHash) && calculatedHash.toLowerCase() === secureHash.toLowerCase();

    const txnRef = queryParameters['vnp_TxnRef'] || '';
    // Tách orderCode từ TxnRef (định dạng {orderCode}-{timestamp})
    let orderCode = txnRef;
    if (txnRef.includes('___')) {
      orderCode = txnRef.split('___')[0];
    } else {
      const lastDash = txnRef.lastIndexOf('-');
      const lastUnderscore = txnRef.lastIndexOf('_');
      const sepIndex = Math.max(lastDash, lastUnderscore);
      if (sepIndex > 0) {
        orderCode = txnRef.substring(0, sepIndex);
      }
    }

    const responseCode = queryParameters['vnp_ResponseCode'] || '';
    const transactionStatus = queryParameters['vnp_TransactionStatus'] || '';
    const transactionNo = queryParameters['vnp_TransactionNo'] || '';
    const bankCode = queryParameters['vnp_BankCode'] || '';
    const payDate = queryParameters['vnp_PayDate'] || '';
    const rawAmount = Number(queryParameters['vnp_Amount'] || 0);
    const amount = rawAmount > 0 ? rawAmount / 100 : 0;

    const isSuccess = isValid && responseCode === '00' && transactionStatus === '00';

    return {
      isValid,
      orderCode,
      responseCode,
      transactionStatus,
      transactionNo,
      amount,
      bankCode,
      payDate,
      isSuccess,
    };
  }

  /**
   * Tự động xác nhận đơn hoàn tất thanh toán sau khi VNPay thanh toán thành công
   */
  public async confirmOrderPayment(data: {
    orderCode: string;
    transactionNo: string;
    amount: number;
    bankCode?: string;
    payDate?: string;
  }): Promise<{ success: boolean; message: string; orderId?: number; RspCode?: string; rspCode?: string }> {
    const { orderCode, transactionNo, amount, bankCode, payDate } = data;
    console.info(`[VnPayService] Đang tự động xác nhận thanh toán cho đơn hàng: ${orderCode}`);

    // Query order from PostgreSQL
    const orderRes = await query(
      `SELECT id, order_code, customer_id, amount_total, status, payment_status, notes 
       FROM orders WHERE order_code = $1 LIMIT 1`,
      [orderCode]
    );

    if (orderRes.rows.length === 0) {
      console.warn(`[VnPayService] Không tìm thấy đơn hàng: ${orderCode}`);
      return {
        success: false,
        RspCode: '01',
        rspCode: '01',
        message: 'Order not found',
      };
    }

    const order = orderRes.rows[0];
    const paidAmount = Number(amount);

    // Reconcile amount strictly using Math.round
    if (Math.round(Number(order.amount_total)) !== Math.round(Number(paidAmount))) {
      console.warn(`[VnPayService] Số tiền không khớp cho đơn ${orderCode}: cần ${order.amount_total}, trả ${paidAmount}`);
      return {
        success: false,
        RspCode: '04',
        rspCode: '04',
        message: 'Invalid amount',
      };
    }

    // Check if order was already paid
    if (order.payment_status === 'paid') {
      return {
        success: true,
        RspCode: '02',
        rspCode: '02',
        message: 'Order already confirmed',
        orderId: order.id,
      };
    }

    // Update order status in PostgreSQL (đồng bộ chuẩn trạng thái B2B & số tiền đã thanh toán)
    const paymentLog = `[VNPAY AUTO-CONFIRM]\nĐã thanh toán thành công qua cổng VNPAY.\nMã GD VNPAY: ${transactionNo}\nNgân hàng: ${bankCode || 'NCB'}\nSố tiền: ${paidAmount.toLocaleString('vi-VN')} đ\nThời gian: ${payDate || new Date().toISOString()}`;
    const newNote = order.notes ? `${order.notes}\n\n${paymentLog}` : paymentLog;
    const nextStatus =
      order.status === 'delivered' || order.status === 'completed'
        ? 'completed'
        : 'confirmed';

    await query(
      `UPDATE orders 
       SET paid_amount = GREATEST(COALESCE(paid_amount, 0), COALESCE(amount_total, $3)),
           payment_status = 'paid',
           status = $1,
           notes = $2,
           updated_at = NOW() 
       WHERE id = $4`,
      [nextStatus, newNote, paidAmount, order.id]
    );

    // Fetch order items and deduct inventory
    try {
      const itemsRes = await query(
        `SELECT sku, product_name, quantity FROM order_items WHERE order_id = $1`,
        [order.id]
      );
      const stockLines = itemsRes.rows.map((row) => ({
        sku: row.sku,
        productName: row.product_name || row.name || 'Sản phẩm',
        quantity: Number(row.quantity || 0),
      }));

      await inventoryStorageService.confirmOrderStock(
        stockLines,
        orderCode,
        'Cổng thanh toán VNPAY (Tự động)'
      );
    } catch (invErr: any) {
      console.warn('[VnPayService] Lỗi xác nhận trừ tồn kho nội bộ:', invErr.message);
    }

    return {
      success: true,
      RspCode: '00',
      rspCode: '00',
      message: 'Xác nhận đơn hàng và hoàn tất thanh toán VNPAY thành công.',
      orderId: order.id,
    };
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        sorted[encodeURIComponent(key)] = encodeURIComponent(String(obj[key])).replace(/%20/g, '+');
      }
    }
    return sorted;
  }

  private getVnpayCreateDate(): string {
    const d = new Date();
    // UTC+7 (Vietnam Time)
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const vnDate = new Date(utc + 7 * 3600000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${vnDate.getFullYear()}${pad(vnDate.getMonth() + 1)}${pad(vnDate.getDate())}${pad(vnDate.getHours())}${pad(vnDate.getMinutes())}${pad(vnDate.getSeconds())}`;
  }

  private removeVietnameseSign(str: string): string {
    if (!str) return '';
    const signs = [
      'aAeEoOuUiIdDyY',
      'áàạảãâấầậẩẫăắằặẳẵ',
      'ÁÀẠẢÃÂẤẦẬẨẪĂẮẰẶẲẴ',
      'éèẹẻẽêếềệểễ',
      'ÉÈẸẺẼÊẾỀỆỂỄ',
      'óòọỏõôốồộổỗơớờợởỡ',
      'ÓÒỌỎÕÔỐỒỘỔỖƠỚỜỢỞỠ',
      'úùụủũưứừựửữ',
      'ÚÙỤỦŨƯỨỪỰỬỮ',
      'íìịỉĩ',
      'ÍÌỊỈĨ',
      'đ',
      'Đ',
      'ýỳỵỷỹ',
      'ÝỲỴỶỸ',
    ];

    let result = str;
    for (let i = 1; i < signs.length; i++) {
      for (let j = 0; j < signs[i].length; j++) {
        result = result.split(signs[i][j]).join(signs[0][i - 1]);
      }
    }

    return result.replace(/[^a-zA-Z0-9_\- ]/g, '');
  }
}

export const vnPayService = new VnPayService();
