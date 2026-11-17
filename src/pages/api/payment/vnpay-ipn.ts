// src/pages/api/payment/vnpay-ipn.ts
import type { APIRoute } from 'astro';
import { vnPayService } from '@/services/vnpay.service';

export const prerender = false;

async function handleIpn(request: Request, url: URL): Promise<Response> {
  try {
    const queryParams: Record<string, string> = {};

    // Đọc từ query string
    url.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    // Nếu là POST và có body form-data hoặc json
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await request.json().catch(() => ({}));
        Object.assign(queryParams, json);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData().catch(() => null);
        if (formData) {
          formData.forEach((val, key) => {
            queryParams[key] = String(val);
          });
        }
      }
    }

    const validation = await vnPayService.parseAndValidateCallback(queryParams);

    if (!validation.isValid) {
      console.warn('[VNPay IPN] Chữ ký không hợp lệ.');
      return new Response(JSON.stringify({ RspCode: '97', Message: 'Invalid signature' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!validation.orderCode) {
      return new Response(JSON.stringify({ RspCode: '01', Message: 'Order not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (validation.isSuccess) {
      // Tự động xác nhận đơn hoàn tất thanh toán
      const confirmResult = await vnPayService.confirmOrderPayment({
        orderCode: validation.orderCode,
        transactionNo: validation.transactionNo,
        amount: validation.amount,
        bankCode: validation.bankCode,
        payDate: validation.payDate,
      });

      if (confirmResult.success) {
        console.info(`[VNPay IPN] Xác nhận đơn hàng ${validation.orderCode} thành công.`);
        return new Response(JSON.stringify({ RspCode: '00', Message: 'Confirm success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ RspCode: '99', Message: 'Update fail' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Giao dịch không thành công
    return new Response(JSON.stringify({ RspCode: '00', Message: 'Confirm success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[VNPay IPN Error]:', error);
    return new Response(JSON.stringify({ RspCode: '99', Message: error.message || 'Unknown error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const GET: APIRoute = async ({ request, url }) => handleIpn(request, url);
export const POST: APIRoute = async ({ request, url }) => handleIpn(request, url);
