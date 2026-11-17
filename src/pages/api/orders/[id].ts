// src/pages/api/orders/[id].ts
import type { APIRoute } from 'astro';
import { query, withTransaction } from '@/lib/db';
import { orderService } from '@/services/order.service';
import { inventoryStorageService } from '@/services/inventory-storage.service';
import type { PoolClient } from 'pg';

export const prerender = false;

// 1. GET: Lấy chi tiết đơn hàng
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const paramId = params.id;
    if (!paramId) {
      return new Response(
        JSON.stringify({ error: 'Mã đơn hàng không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Tra cứu đơn hàng từ PostgreSQL
    const order = await orderService.getOrderById(paramId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy đơn hàng' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const auth = locals?.auth;
    // Nếu có đăng nhập đại lý, kiểm tra quyền sở hữu đơn hàng
    if (auth?.partnerId && order.customer_id && Number(order.customer_id) !== Number(auth.partnerId) && !auth?.isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Không có quyền truy cập đơn hàng này' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const canEdit = order.status === 'draft';
    const canCancel = order.status === 'draft' || order.status === 'confirmed';

    return new Response(
      JSON.stringify({
        success: true,
        id: order.order_code || order.id,
        order_code: order.order_code,
        raw_id: order.id,
        amount_total: Number(order.amount_total || 0),
        amount_untaxed: Number(order.amount_untaxed || 0),
        amount_discount: Number(order.amount_discount || 0),
        paid_amount: Number(order.paid_amount || 0),
        state: order.status,
        status: order.status,
        date_order: order.date_order || order.created_at,
        created_at: order.created_at,
        note: order.notes || order.note || '',
        recipient_name: order.shipping_name || order.partner_name || '',
        recipient_phone: order.shipping_phone || order.partner_phone || '',
        shipping_address: order.delivery_address || order.shipping_address || '',
        payment_method: order.payment_method || 'bank_transfer',
        payment_status: order.payment_status || 'unpaid',
        can_edit: canEdit,
        can_cancel: canCancel,
        can_edit_or_cancel: canEdit,
        items: (order.items || []).map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          sku: it.sku,
          name: it.product_name || it.name,
          product_name: it.product_name || it.name,
          quantity: Number(it.quantity || 1),
          qty: Number(it.quantity || 1),
          price_unit: Number(it.price_unit || 0),
          discount_percent: Number(it.discount_percent || 0),
          price_subtotal: Number(it.price_total || it.price_subtotal || 0),
          subtotal: Number(it.price_total || it.price_subtotal || 0),
          image_url: it.image_url || '',
          unit: it.unit || 'Cái',
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Order Detail Error]:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi tra cứu đơn hàng' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 2. PATCH: Chỉnh sửa thông tin giao hàng & ghi chú đơn hàng
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const paramId = params.id;
    const auth = locals?.auth;

    if (!auth?.isAuthenticated || !auth?.isDealer || !auth?.partnerId) {
      return new Response(
        JSON.stringify({ error: 'Chưa đăng nhập đại lý' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partnerId = Number(auth.partnerId);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Dữ liệu yêu cầu không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const order = await orderService.getOrderById(paramId || '', partnerId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy đơn hàng' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (order.status !== 'draft') {
      return new Response(
        JSON.stringify({ error: 'Đại lý chỉ có thể chỉnh sửa đơn hàng khi ở trạng thái Chờ xác nhận (Đơn nháp)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let updatedOrderData: any = null;

    await withTransaction(async (c: PoolClient) => {
      // Lưu lại trạng thái cũ cho audit log
      const oldData = {
        shipping_name: order.shipping_name,
        partner_phone: order.partner_phone,
        shipping_address: order.shipping_address,
        notes: order.notes,
        payment_method: order.payment_method,
        amount_total: Number(order.amount_total),
        items: (order.items || []).map((it: any) => ({
          sku: it.sku,
          product_id: it.product_id,
          quantity: it.quantity,
          price_unit: it.price_unit,
          price_total: it.price_total,
        })),
      };

      // 1. Cập nhật thông tin giao hàng & ghi chú nếu có
      const updates: string[] = [];
      const paramsList: any[] = [];

      if (body.shipping_name || body.recipient_name) {
        paramsList.push(String(body.shipping_name || body.recipient_name).trim());
        updates.push(`shipping_name = $${paramsList.length}`);
      }

      if (body.recipient_phone || body.partner_phone) {
        paramsList.push(String(body.recipient_phone || body.partner_phone).trim());
        updates.push(`partner_phone = $${paramsList.length}`);
      }

      if (body.shipping_address || body.delivery_address) {
        paramsList.push(String(body.shipping_address || body.delivery_address).trim());
        updates.push(`shipping_address = $${paramsList.length}`);
      }

      if (body.note !== undefined || body.notes !== undefined) {
        paramsList.push(String(body.note !== undefined ? body.note : body.notes).trim());
        updates.push(`notes = $${paramsList.length}`);
      }

      if (body.payment_method) {
        const pm = String(body.payment_method).toLowerCase().trim();
        if (['vnpay', 'cod', 'bank_transfer'].includes(pm)) {
          paramsList.push(pm);
          updates.push(`payment_method = $${paramsList.length}`);
        }
      }

      // 2. Cập nhật items và tính toán lại tồn kho & tiền hàng
      let calculatedTotal = Number(order.amount_total);
      let calculatedUntaxed = Number(order.amount_untaxed);

      if (Array.isArray(body.items) && body.items.length > 0) {
        // Hoàn lại reserved tồn kho cho các item cũ của đơn hàng
        for (const oldItem of (order.items || [])) {
          if (oldItem.sku && Number(oldItem.quantity) > 0) {
            await inventoryStorageService.releaseStock(
              oldItem.sku,
              Number(oldItem.quantity),
              order.order_code,
              c
            );
          }
        }

        // Xóa items cũ
        await c.query(`DELETE FROM order_items WHERE order_id = $1`, [order.id]);

        let newTotal = 0;
        let newUntaxed = 0;

        for (const it of body.items) {
          const qty = Math.max(1, parseInt(it.qty ?? it.quantity, 10) || 1);
          const sku = String(it.sku || '').trim().toUpperCase();
          const rawId = it.product_id ?? it.id;
          const productId = rawId ? Number(rawId) : null;

          // Tra cứu giá chuẩn và tên từ bảng products để tránh gian lận giá
          const pRes = await c.query(
            `SELECT id, name, sku, wholesale_price, price FROM products 
             WHERE (sku != '' AND UPPER(sku) = $1) OR id = $2 LIMIT 1`,
            [sku, productId || -1]
          );

          if (pRes.rows.length === 0) {
            throw new Error(`Sản phẩm ${sku || productId} không tồn tại`);
          }

          const product = pRes.rows[0];
          const unitPrice = Number(product.wholesale_price || product.price || 0);
          const lineTotal = unitPrice * qty;

          // Giữ chỗ tồn kho mới
          await inventoryStorageService.reserveStock(
            product.sku,
            qty,
            order.order_code,
            c
          );

          newTotal += lineTotal;
          newUntaxed += lineTotal;

          await c.query(
            `INSERT INTO order_items (
              order_id, product_id, sku, product_name, quantity, price_unit, discount_percent, price_total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              order.id,
              product.id,
              product.sku,
              product.name,
              qty,
              unitPrice,
              0,
              lineTotal,
            ]
          );
        }

        calculatedTotal = newTotal;
        calculatedUntaxed = newUntaxed;

        // Cập nhật chênh lệch doanh số tích lũy của khách hàng
        const diffAmount = calculatedTotal - Number(order.amount_total);
        if (diffAmount !== 0 && order.customer_id) {
          await c.query(
            `UPDATE customers 
             SET cumulative_sales = GREATEST(0, cumulative_sales + $1), updated_at = NOW() 
             WHERE id = $2`,
            [diffAmount, order.customer_id]
          );
        }
      }

      paramsList.push(calculatedTotal);
      updates.push(`amount_total = $${paramsList.length}`);

      paramsList.push(calculatedUntaxed);
      updates.push(`amount_untaxed = $${paramsList.length}`);

      paramsList.push(order.id);
      const updateRes = await c.query(
        `UPDATE orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramsList.length} RETURNING *`,
        paramsList
      );
      updatedOrderData = updateRes.rows[0];

      // Ghi nhật ký vào order_edit_logs
      await c.query(
        `INSERT INTO order_edit_logs (order_id, order_code, customer_id, action, old_data, new_data, performed_by)
         VALUES ($1, $2, $3, 'UPDATE_ORDER', $4, $5, 'dealer')`,
        [
          order.id,
          order.order_code,
          partnerId,
          JSON.stringify(oldData),
          JSON.stringify({
            shipping_name: updatedOrderData.shipping_name,
            partner_phone: updatedOrderData.partner_phone,
            shipping_address: updatedOrderData.shipping_address,
            notes: updatedOrderData.notes,
            amount_total: calculatedTotal,
            payment_method: updatedOrderData.payment_method,
            items: body.items,
          }),
        ]
      );
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật đơn hàng thành công',
        order: updatedOrderData,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Order PATCH Error]:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi khi cập nhật đơn hàng' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 3. DELETE: Hủy đơn hàng & giải phóng tồn kho
export const DELETE: APIRoute = async ({ params, locals }) => {
  return handleCancelOrder(params.id, locals);
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  if (body?.action === 'cancel') {
    return handleCancelOrder(params.id, locals);
  }

  return new Response(
    JSON.stringify({ error: 'Action không được hỗ trợ' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
};

async function handleCancelOrder(paramId: string | undefined, locals: any) {
  try {
    const auth = locals?.auth;
    if (!auth?.isAuthenticated || !auth?.isDealer || !auth?.partnerId) {
      return new Response(
        JSON.stringify({ error: 'Chưa đăng nhập đại lý' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partnerId = Number(auth.partnerId);
    if (!paramId) {
      return new Response(
        JSON.stringify({ error: 'Mã đơn hàng không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const order = await orderService.getOrderById(paramId, partnerId);
    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy đơn hàng' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (order.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: true, message: 'Đơn hàng đã được hủy trước đó' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (order.status === 'delivered' || order.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Không thể hủy đơn hàng đã giao hoặc đã hoàn tất' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Thực hiện hủy đơn qua orderService
    await orderService.updateOrderStatus(order.id, 'cancelled');

    return new Response(
      JSON.stringify({ success: true, message: 'Đã hủy đơn hàng thành công' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Cancel Order Error]:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi khi hủy đơn hàng' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
