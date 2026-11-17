// src/pages/api/payment/vnpay-callback.ts
import type { APIRoute } from 'astro';
import { vnPayService } from '@/services/vnpay.service';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const validation = await vnPayService.parseAndValidateCallback(queryParams);

    if (!validation.isValid) {
      console.warn('[VNPay Callback] Chữ ký không hợp lệ từ VNPay.');
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/hoan-tat?order_id=${encodeURIComponent(validation.orderCode || '')}&payment=invalid_signature`,
        },
      });
    }

    if (validation.isSuccess) {
      console.info(`[VNPay Callback] Thanh toán thành công cho đơn hàng: ${validation.orderCode}, Số tiền: ${validation.amount}`);

      // Tự động xác nhận đơn hoàn tất thanh toán
      try {
        await vnPayService.confirmOrderPayment({
          orderCode: validation.orderCode,
          transactionNo: validation.transactionNo,
          amount: validation.amount,
          bankCode: validation.bankCode,
          payDate: validation.payDate,
        });
      } catch (confirmErr: any) {
        console.error('[VNPay Callback] Lỗi khi tự động xác nhận đơn:', confirmErr.message);
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: `/hoan-tat?order_id=${encodeURIComponent(validation.orderCode)}&payment=success&vnp_TransactionNo=${encodeURIComponent(validation.transactionNo)}`,
        },
      });
    }

    // Trường hợp hủy thanh toán hoặc giao dịch thất bại
    console.warn(`[VNPay Callback] Thanh toán thất bại/hủy. Mã đơn: ${validation.orderCode}, ResponseCode: ${validation.responseCode}`);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/hoan-tat?order_id=${encodeURIComponent(validation.orderCode)}&payment=failed&code=${encodeURIComponent(validation.responseCode)}`,
      },
    });
  } catch (error: any) {
    console.error('[VNPay Callback Error]:', error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/hoan-tat?payment=error&message=${encodeURIComponent(error.message || 'Lỗi xử lý phản hồi VNPay')}`,
      },
    });
  }
};
