// src/pages/api/orders/history.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const auth = locals.auth;

    if (!auth?.isAuthenticated || !auth?.isDealer || !auth?.partnerId) {
      return new Response(
        JSON.stringify({ error: 'Chưa đăng nhập đại lý' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partnerId = Number(auth.partnerId);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return new Response(
        JSON.stringify({ error: 'Thông tin đại lý không hợp lệ' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Query historical orders for this partner directly from PostgreSQL
    const res = await query(
      `SELECT o.id, o.order_code, o.amount_total, o.paid_amount, o.status, 
              o.payment_method, o.payment_status,
              COALESCE(o.date_order, o.created_at) as date_order,
              COUNT(oi.id) as items_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.customer_id = $1
       GROUP BY o.id
       ORDER BY COALESCE(o.date_order, o.created_at) DESC
       LIMIT 50`,
      [partnerId]
    );

    const orders = res.rows.map((ord: any) => ({
      id: ord.order_code || String(ord.id),
      order_code: ord.order_code,
      raw_id: ord.id,
      date: ord.date_order ? new Date(ord.date_order).toISOString().split('T')[0] : '',
      amount_total: Number(ord.amount_total || 0),
      paid_amount: Number(ord.paid_amount || 0),
      state: ord.status || 'draft',
      status: ord.status || 'draft',
      payment_method: ord.payment_method || 'bank_transfer',
      payment_status: ord.payment_status || 'unpaid',
      items_count: Number(ord.items_count || 0),
    }));

    return new Response(JSON.stringify(orders), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[API Orders History Error]:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi tra cứu lịch sử đơn hàng' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};