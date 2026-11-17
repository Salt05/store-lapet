// src/pages/api/admin/dashboard/stats.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const [ordersRes, customersRes, inventoryRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_orders,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          COALESCE(SUM(CASE WHEN status IN ('confirmed', 'delivered', 'completed') THEN amount_total ELSE 0 END), 0) as confirmed_revenue,
          COALESCE(SUM(CASE WHEN status != 'cancelled' THEN COALESCE(paid_amount, 0) ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status IN ('confirmed', 'delivered') AND COALESCE(paid_amount, 0) < amount_total THEN (amount_total - COALESCE(paid_amount, 0)) ELSE 0 END), 0) as total_receivable
        FROM orders
      `),
      query(`
        SELECT 
          COUNT(*) as total_dealers,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_dealers
        FROM customers
      `),
      query(`
        SELECT 
          COUNT(*) as total_skus,
          COUNT(CASE WHEN (on_hand - reserved) <= min_stock THEN 1 END) as low_stock_count,
          COALESCE(SUM(on_hand - reserved), 0) as total_available
        FROM inventory_items
        WHERE is_active = TRUE
      `),
    ]);

    const ord = ordersRes.rows[0] || {};
    const cust = customersRes.rows[0] || {};
    const inv = inventoryRes.rows[0] || {};

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          orders: {
            total: Number(ord.total_orders || 0),
            draft: Number(ord.draft_orders || 0),
            confirmed: Number(ord.confirmed_orders || 0),
            delivered: Number(ord.delivered_orders || 0),
            completed: Number(ord.completed_orders || 0),
            cancelled: Number(ord.cancelled_orders || 0),
          },
          revenue: {
            confirmedTotal: Number(ord.confirmed_revenue || 0),
            totalPaid: Number(ord.total_paid || 0),
            totalReceivable: Number(ord.total_receivable || 0),
          },
          dealers: {
            total: Number(cust.total_dealers || 0),
            active: Number(cust.active_dealers || 0),
          },
          inventory: {
            totalSkus: Number(inv.total_skus || 0),
            lowStockCount: Number(inv.low_stock_count || 0),
            totalAvailable: Number(inv.total_available || 0),
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Admin Dashboard Stats]:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi truy vấn thống kê' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

