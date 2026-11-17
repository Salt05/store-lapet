// src/pages/api/payment/vnpay-simulate.ts
import type { APIRoute } from 'astro';
import { vnPayService } from '@/services/vnpay.service';

export const prerender = false;

/**
 * Endpoint giả lập thanh toán VNPAY thành công (dành cho môi trường dev/kiểm thử
 * khi tài khoản Sandbox VNPAY của merchant đang chờ duyệt hoặc gặp lỗi code=71)
 */
export const GET: APIRoute = async ({ url }) => {
  if (import.meta.env.PROD) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const orderCode = url.searchParams.get('order_code') || url.searchParams.get('order_id');
  const amount = Number(url.searchParams.get('amount') || 150000);

  if (!orderCode) {
    return new Response('Thiếu tham số order_code để giả lập thanh toán.', { status: 400 });
  }

  const transactionNo = `SIM_VNP_${Date.now()}`;
  const payDate = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

  // Tự động xác nhận đơn hoàn tất thanh toán
  try {
    await vnPayService.confirmOrderPayment({
      orderCode,
      transactionNo,
      amount,
      bankCode: 'NCB_SIMULATOR',
      payDate,
    });
  } catch (err: any) {
    console.error('[VNPAY Simulation Error]:', err.message);
  }

  // Chuyển hướng về trang hoàn tất với cờ thanh toán thành công
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/hoan-tat?order_id=${encodeURIComponent(orderCode)}&payment=success&vnp_TransactionNo=${encodeURIComponent(transactionNo)}`,
    },
  });
};

