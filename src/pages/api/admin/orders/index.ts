// src/pages/api/admin/orders/index.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/config/order-constants';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || url.searchParams.get('state') || '';
    const dateFrom = url.searchParams.get('date_from') || '';
    const dateTo = url.searchParams.get('date_to') || '';
    const paymentStatus = url.searchParams.get('payment_status') || '';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100);
    const page = Math.max(Number(url.searchParams.get('page') || 1), 1);
    const offset = (page - 1) * limit;

    let countSql = `SELECT COUNT(*) as total FROM orders o WHERE 1=1`;
    let dataSql = `
      SELECT 
        o.id,
        o.order_code,
        o.client_order_ref,
        COALESCE(o.partner_name, c.name, 'Đại lý B2B') as customer_name,
        COALESCE(o.partner_phone, c.phone, '') as customer_phone,
        COALESCE(o.partner_email, c.email, '') as customer_email,
        o.customer_id,
        TO_CHAR(COALESCE(o.date_order, o.created_at), 'YYYY-MM-DD') as date,
        o.amount_untaxed,
        o.amount_discount,
        o.amount_total,
        COALESCE(o.paid_amount, 0) as paid_amount,
        (o.amount_total - COALESCE(o.paid_amount, 0)) as remaining_amount,
        o.status,
        o.payment_status,
        o.payment_method,
        o.shipping_name,
        o.shipping_address,
        o.notes,
        o.created_at,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    const filterParams: any[] = [];

    // Lọc theo trạng thái đơn hàng (draft, confirmed, delivered, completed, cancelled)
    if (status && status !== 'all') {
      filterParams.push(status);
      countSql += ` AND o.status = $${filterParams.length}`;
      dataSql += ` AND o.status = $${filterParams.length}`;
    }

    // Lọc theo khoảng ngày
    if (dateFrom) {
      filterParams.push(`${dateFrom} 00:00:00`);
      countSql += ` AND COALESCE(o.date_order, o.created_at) >= $${filterParams.length}`;
      dataSql += ` AND COALESCE(o.date_order, o.created_at) >= $${filterParams.length}`;
    }
    if (dateTo) {
      filterParams.push(`${dateTo} 23:59:59`);
      countSql += ` AND COALESCE(o.date_order, o.created_at) <= $${filterParams.length}`;
      dataSql += ` AND COALESCE(o.date_order, o.created_at) <= $${filterParams.length}`;
    }

    // Lọc theo trạng thái thanh toán (unpaid, partial, paid)
    if (paymentStatus && paymentStatus !== 'all') {
      filterParams.push(paymentStatus);
      countSql += ` AND o.payment_status = $${filterParams.length}`;
      dataSql += ` AND o.payment_status = $${filterParams.length}`;
    }

    // Tìm kiếm đa tiêu chí: mã đơn, mã tham chiếu, tên khách, số điện thoại
    if (search) {
      filterParams.push(`%${search}%`);
      const sIdx = filterParams.length;
      const searchCond = `(
        o.order_code ILIKE $${sIdx} 
        OR o.client_order_ref ILIKE $${sIdx} 
        OR o.partner_name ILIKE $${sIdx} 
        OR o.partner_phone ILIKE $${sIdx} 
        OR c.name ILIKE $${sIdx} 
        OR c.phone ILIKE $${sIdx}
      )`;
      countSql += ` AND ${searchCond}`;
      dataSql += ` AND ${searchCond}`;
    }

    // Đếm tổng số bản ghi & số đơn nháp (draft count)
    const [totalRes, draftRes] = await Promise.all([
      query(countSql, filterParams),
      query(`SELECT COUNT(*) as count FROM orders WHERE status = 'draft';`),
    ]);

    const totalMatching = Number(totalRes.rows[0]?.total || 0);
    const draftCount = Number(draftRes.rows[0]?.count || 0);

    const pageParams = [...filterParams, limit, offset];
    dataSql += ` 
      GROUP BY o.id, c.id
      ORDER BY COALESCE(o.date_order, o.created_at) DESC, o.id DESC 
      LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length};
    `;

    const dataRes = await query(dataSql, pageParams);
    const mapped = dataRes.rows.map((o: any) => ({
      id: o.id,
      name: o.order_code,
      order_code: o.order_code,
      client_order_ref: o.client_order_ref || '',
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      customer_email: o.customer_email,
      date: o.date,
      amount_total: Number(o.amount_total || 0),
      total: Number(o.amount_total || 0),
      paid_amount: Number(o.paid_amount || 0),
      remaining_amount: Math.max(0, Number(o.amount_total || 0) - Number(o.paid_amount || 0)),
      status: o.status || 'draft',
      state: o.status || 'draft',
      payment_status: o.payment_status || 'unpaid',
      invoice_status: o.payment_status || 'unpaid',
      status_label: ORDER_STATUS_LABEL[o.status] || { label: o.status, color: '' },
      payment_label: PAYMENT_STATUS_LABEL[o.payment_status] || { label: o.payment_status, color: '' },
      items_count: Number(o.items_count || 0),
      shipping_name: o.shipping_name,
      shipping_address: o.shipping_address,
      notes: o.notes,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: mapped,
        draft_count: draftCount,
        page,
        limit,
        total: totalMatching,
        totalPages: Math.max(1, Math.ceil(totalMatching / limit)),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Orders API Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi tra cứu đơn hàng' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
