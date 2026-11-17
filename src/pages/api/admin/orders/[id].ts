// src/pages/api/admin/orders/[id].ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';
import { orderService } from '@/services/order.service';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/config/order-constants';

export const prerender = false;

// 1. GET: Lấy chi tiết đơn hàng cho Admin
export const GET: APIRoute = async ({ params }) => {
  try {
    const paramId = params.id;
    if (!paramId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã đơn hàng không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const order = await orderService.getOrderById(paramId);
    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đơn hàng' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Tra cứu thông tin đại lý
    let customerInfo = null;
    if (order.customer_id) {
      const cRes = await query(
        `SELECT id, code, name, phone, email, tier, cumulative_sales, is_active 
         FROM customers WHERE id = $1`,
        [order.customer_id]
      );
      if (cRes.rows.length > 0) {
        customerInfo = cRes.rows[0];
      }
    }

    const total = Number(order.amount_total || 0);
    const paid = Number(order.paid_amount || 0);

    // Lấy lịch sử và danh sách thanh toán
    const [history, payments] = await Promise.all([
      orderService.getOrderHistory(paramId),
      orderService.getOrderPayments(paramId),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: order.id,
          order_code: order.order_code,
          client_order_ref: order.client_order_ref || '',
          date_order: order.date_order || order.created_at,
          created_at: order.created_at,
          status: order.status || 'draft',
          status_label: ORDER_STATUS_LABEL[order.status] || { label: order.status, color: '' },
          payment_status: order.payment_status || 'unpaid',
          payment_label: PAYMENT_STATUS_LABEL[order.payment_status] || { label: order.payment_status, color: '' },
          amount_untaxed: Number(order.amount_untaxed || 0),
          amount_discount: Number(order.amount_discount || 0),
          amount_total: total,
          paid_amount: paid,
          remaining_amount: Math.max(0, total - paid),
          payment_method: order.payment_method || 'bank_transfer',
          notes: order.notes || order.note || '',
          shipping_name: order.shipping_name || customerInfo?.name || '',
          shipping_phone: order.partner_phone || customerInfo?.phone || '',
          shipping_address: order.shipping_address || order.delivery_address || '',
          customer: customerInfo,
          history,
          payments,
          items: (order.items || []).map((it: any) => ({
            id: it.id,
            product_id: it.product_id,
            sku: it.sku,
            name: it.product_name || it.name,
            quantity: Number(it.quantity || 1),
            price_unit: Number(it.price_unit || 0),
            discount_percent: Number(it.discount_percent || 0),
            price_total: Number(it.price_total || it.price_subtotal || 0),
            image_url: it.image_url || '',
            unit: it.unit || 'Cái',
          })),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Admin Order Detail GET Error]:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi tra cứu đơn hàng' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 2. PATCH: Admin cập nhật trạng thái đơn, ghi nhận thanh toán, hoặc sửa ghi chú
export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const paramId = params.id;
    if (!paramId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã đơn hàng không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu JSON không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { action } = body;

    // 2.1 Cập nhật trạng thái xử lý đơn (Fulfillment)
    if (action === 'update_status') {
      const { status } = body;
      if (!status) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu trạng thái mới (status)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const updated = await orderService.updateOrderStatus(paramId, status);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã cập nhật trạng thái đơn hàng sang "${ORDER_STATUS_LABEL[status]?.label || status}" thành công`,
          data: updated,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2.2 Ghi nhận khoản thanh toán từ đại lý
    if (action === 'record_payment') {
      const amount = Number(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Số tiền thanh toán phải lớn hơn 0' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const updated = await orderService.recordPayment(paramId, amount, {
        method: body.payment_method || body.method || 'bank_transfer',
        transactionRef: body.transaction_ref || body.transactionRef || '',
        notes: body.notes || body.note || '',
        performedBy: body.performed_by || 'Admin',
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã ghi nhận thanh toán ${new Intl.NumberFormat('vi-VN').format(amount)} ₫ thành công!`,
          data: updated,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2.3 Chỉnh sửa toàn diện thông tin đơn hàng & sản phẩm (Edit Order)
    if (action === 'edit_order') {
      const updated = await orderService.updateOrderDetails(paramId, {
        shipping_name: body.shipping_name,
        shipping_phone: body.shipping_phone,
        shipping_address: body.shipping_address,
        notes: body.notes !== undefined ? body.notes : body.note,
        items: body.items,
        performedBy: body.performed_by || 'Admin',
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã lưu chỉnh sửa đơn hàng thành công!',
          data: updated,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2.4 Cập nhật ghi chú / địa chỉ giao hàng riêng lẻ
    if (action === 'update_shipping' || action === 'update_notes') {
      const updates: string[] = [];
      const paramsList: any[] = [];

      if (body.shipping_name !== undefined) {
        paramsList.push(String(body.shipping_name).trim());
        updates.push(`shipping_name = $${paramsList.length}`);
      }
      if (body.shipping_phone !== undefined) {
        paramsList.push(String(body.shipping_phone).trim());
        updates.push(`partner_phone = $${paramsList.length}`);
      }
      if (body.shipping_address !== undefined) {
        paramsList.push(String(body.shipping_address).trim());
        updates.push(`shipping_address = $${paramsList.length}`);
      }
      if (body.notes !== undefined || body.note !== undefined) {
        paramsList.push(String(body.notes !== undefined ? body.notes : body.note).trim());
        updates.push(`notes = $${paramsList.length}`);
      }

      if (updates.length > 0) {
        paramsList.push(paramId);
        await query(
          `UPDATE orders SET ${updates.join(', ')}, updated_at = NOW() 
           WHERE id = $${paramsList.length} OR order_code = $${paramsList.length}`,
          paramsList
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Đã cập nhật thông tin đơn hàng thành công' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Action '${action}' không được hỗ trợ` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Admin Order Detail PATCH Error]:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi cập nhật đơn hàng' }),
      { status: err.statusCode || 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
