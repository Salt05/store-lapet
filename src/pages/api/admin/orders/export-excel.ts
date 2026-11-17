// src/pages/api/admin/orders/export-excel.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get('status') || url.searchParams.get('state') || '').trim();
    const search = (url.searchParams.get('q') || '').trim();

    let sql = `
      SELECT 
        o.id,
        o.order_code,
        o.client_order_ref,
        COALESCE(o.partner_name, c.name, 'Đại lý B2B') AS customer_name,
        COALESCE(o.partner_phone, c.phone, '') AS customer_phone,
        TO_CHAR(o.date_order, 'YYYY-MM-DD HH24:MI') AS order_date,
        o.status,
        o.payment_status,
        o.payment_method,
        o.amount_total,
        o.paid_amount,
        o.notes
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter);
      sql += ` AND o.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (o.order_code ILIKE $${params.length} OR o.client_order_ref ILIKE $${params.length} OR o.partner_name ILIKE $${params.length} OR o.partner_phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY o.date_order DESC, o.created_at DESC LIMIT 500;`;

    const res = await query(sql, params);
    const orders = res.rows;

    const statusMap: Record<string, string> = {
      draft: 'Đơn nháp',
      sent: 'Đơn nháp',
      confirmed: 'Đơn bán hàng',
      sale: 'Đơn bán hàng',
      delivered: 'Đã giao',
      completed: 'Đã hoàn tất',
      done: 'Đã hoàn tất',
      cancelled: 'Đã hủy',
      cancel: 'Đã hủy',
    };

    const paymentStatusMap: Record<string, string> = {
      paid: 'Đã thanh toán đủ',
      partial: 'Đã thanh toán một phần',
      unpaid: 'Chưa thanh toán',
    };

    const headers = [
      'STT',
      'Mã Đơn Hàng',
      'Mã Tham Chiếu Web',
      'Khách Hàng / Đại Lý',
      'Số Điện Thoại',
      'Thời Gian Đặt',
      'Trạng Thái Đơn Hàng',
      'Trạng Thái Thanh Toán',
      'Đã Thanh Toán (VNĐ)',
      'Hình Thức Thanh Toán',
      'Tổng Tiền (VNĐ)',
      'Ghi Chú',
    ];

    const rows = orders.map((o, idx) => [
      idx + 1,
      o.order_code || o.id,
      o.client_order_ref || '',
      o.customer_name || 'Đại lý',
      o.customer_phone || '',
      o.order_date || '',
      statusMap[o.status] || o.status || 'Đơn nháp',
      paymentStatusMap[o.payment_status] || 'Chưa thanh toán',
      Math.round(Number(o.paid_amount || 0)),
      o.payment_method === 'vnpay' ? 'VNPAY QR' : 'Chuyển khoản VietQR',
      Math.round(Number(o.amount_total || 0)),
      (o.notes || '').replace(/[\r\n]+/g, ' '),
    ]);

    // UTF-8 BOM encoding ensures Vietnamese diacritics render perfectly in Microsoft Excel
    const BOM = '\uFEFF';
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

    const filename = `Bao_Cao_Don_Hang_LA_PET_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(BOM + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[Orders Excel Export Error]:', error);
    return new Response(JSON.stringify({ error: error.message || 'Lỗi xuất báo cáo Excel' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
