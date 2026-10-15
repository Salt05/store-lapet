// src/pages/api/orders/create.ts
import type { APIRoute } from 'astro';
import { orderService } from '../../../services/order.service';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { partner_id, partnerId, items, note, client_order_ref, shipping_address_id, is_custom_address, custom_address } = body;

    const targetPartnerId = partner_id || partnerId;

    if (!targetPartnerId || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Dữ liệu đơn hàng không hợp lệ.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Tự động gọi orderService đã tích hợp logic chiết khấu tự động
    const result = await orderService.createQuotation({
      partner_id: Number(targetPartnerId),
      items,
      note,
      client_order_ref,
      shipping_address_id,
      is_custom_address,
      custom_address,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Lỗi API tạo đơn hàng:', err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Lỗi xử lý tạo đơn hàng.' }),
      { status: err.statusCode || 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};