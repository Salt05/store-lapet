// src/pages/api/orders/[id]/confirm.ts
import type { APIRoute } from 'astro';
import { orderService } from '@/services/order.service';
import { ORDER_STATUS } from '@/config/order-constants';

export const prerender = false;

function jsonResponse(data: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const paramId = params.id;
    if (!paramId) {
      return jsonResponse({ success: false, error: 'Mã đơn hàng không hợp lệ' }, 400);
    }

    const auth = locals.auth;
    if (!auth?.isAuthenticated || !auth?.isDealer || !auth?.partnerId) {
      return jsonResponse({ success: false, error: 'Chưa đăng nhập đại lý' }, 401);
    }

    const order = await orderService.getOrderById(paramId);
    if (!order) {
      return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404);
    }

    if (order.customer_id && Number(order.customer_id) !== Number(auth.partnerId) && !auth.isAdmin) {
      return jsonResponse({ success: false, error: 'Bạn không có quyền thao tác đơn hàng này' }, 403);
    }

    if (order.status !== ORDER_STATUS.DRAFT && order.status !== 'sent') {
      return jsonResponse(
        { success: false, error: 'Chỉ có thể chốt đơn từ trạng thái Đơn nháp' },
        400
      );
    }

    const updated = await orderService.updateOrderStatus(order.id, ORDER_STATUS.CONFIRMED);
    return jsonResponse({
      success: true,
      message: 'Đã xác nhận chốt đơn bán hàng thành công!',
      order: updated,
    });
  } catch (err: any) {
    console.error('[API Order Confirm Error]:', err);
    return jsonResponse(
      { success: false, error: err?.message || 'Lỗi xác nhận chốt đơn hàng' },
      err?.statusCode || 500
    );
  }
};

