// src/pages/api/payment/vnpay-create.ts
import type { APIRoute } from 'astro';
import { vnPayService } from '@/services/vnpay.service';
import { query } from '@/lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
  try {
    const auth = locals.auth;
    if (!auth?.isAuthenticated || !auth?.isDealer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa đăng nhập hoặc không có quyền Đại lý.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderCode = body?.order_code || body?.orderCode || body?.order_id;

    if (!orderCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã đơn hàng (order_code).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch amount_total directly from PostgreSQL orders table to prevent tampering
    const orderRes = await query(
      `SELECT id, order_code, customer_id, amount_total, status, payment_status 
       FROM orders WHERE (order_code = $1 OR id::text = $1) LIMIT 1`,
      [orderCode]
    );

    if (orderRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng không tồn tại.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const order = orderRes.rows[0];
    const amount = Math.round(Number(order.amount_total));

    if (!amount || isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số tiền thanh toán không hợp lệ.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Xác định IP client
    const forwardedHeader = request.headers.get('x-forwarded-for');
    let ipAddress = forwardedHeader ? forwardedHeader.split(',')[0].trim() : '127.0.0.1';
    if (!ipAddress || ipAddress.includes(':')) {
      ipAddress = '127.0.0.1';
    }

    // Xây dựng returnUrl tuyệt đối
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
    const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'http';
    const returnUrl = `${protocol}://${host}/api/payment/vnpay-callback`;

    const paymentUrl = await vnPayService.createPaymentUrl({
      ipAddress,
      orderCode: String(orderCode),
      amount,
      orderInfo: body?.order_info || `Thanh toan don hang ${orderCode}`,
      returnUrl,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        order_code: orderCode,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API VNPay Create Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi khi khởi tạo thanh toán VNPay.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
