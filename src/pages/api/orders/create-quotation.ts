import type { APIRoute } from 'astro';
import { OrderValidationError, orderService } from '@/services/order.service';

export const prerender = false;

function jsonResponse(data: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { isAuthenticated, isDealer, partnerId } = locals.auth || {};
    const numericPartnerId = Number(partnerId);

    if (!isAuthenticated || !isDealer || !Number.isInteger(numericPartnerId) || numericPartnerId <= 0) {
      return jsonResponse({ error: 'Chưa đăng nhập hoặc không có quyền Đại lý' }, 401);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Payload JSON không hợp lệ' }, 400);
    }

    const rawItems = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      return jsonResponse({ error: 'Danh sách sản phẩm trống' }, 400);
    }

    // Khai báo rõ Type cho item để tránh lỗi TS(7006)
    const normalizedItems = rawItems
    .map((item: any) => ({
      id: Number(item?.id ?? item?.odoo_id),
      sku: String(item?.sku ?? '').trim(),
      qty: parseInt(item?.qty ?? item?.quantity, 10),
    }))
    .filter(
      (item: { id: number; sku: string; qty: number }) =>
        !isNaN(item.id) &&
        item.id > 0 &&
        item.sku.length > 0 &&
        !isNaN(item.qty) &&
        item.qty > 0
    );

    if (normalizedItems.length === 0) {
      return jsonResponse({ error: 'Dữ liệu sản phẩm không hợp lệ' }, 400);
    }

    const result = await orderService.createQuotation({
      partner_id: numericPartnerId,
      payment_method: body?.payment_method,
      shipping_address_id: body?.shipping_address_id ? Number(body.shipping_address_id) : undefined,
      is_custom_address: Boolean(body?.is_custom_address),
      custom_address: body?.custom_address,
      note: body?.note,
      client_order_ref: body?.client_order_ref,
      items: normalizedItems,
    });

    return jsonResponse(result, result.already_exists ? 200 : 201);
  } catch (error: any) {
    console.error('[API Create-Quotation Error]:', error);

    if (error instanceof OrderValidationError) {
      return jsonResponse({ error: error.message }, error.statusCode);
    }

    return jsonResponse(
      { error: error?.message || 'Lỗi khi tạo đơn nháp B2B' },
      500
    );
  }
};