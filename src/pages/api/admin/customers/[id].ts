// src/pages/api/admin/customers/[id].ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { directusAdmin } from '@/lib/directus';
import { readItems } from '@directus/sdk';
import { computeDealerTierMetrics } from './index';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = Number(params.id);
    if (!id || isNaN(id) || id <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã đại lý không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const custRes = await query(
      `SELECT id, code, name, phone, email, address, city, tier, cumulative_sales, is_active, created_at,
              (password_hash IS NOT NULL AND password_hash != '') as has_password
       FROM customers WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (custRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đại lý' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partner = custRes.rows[0];

    // Địa chỉ giao hàng phụ từ PostgreSQL customer_addresses
    let deliveryAddresses: any[] = [];
    try {
      const addrRes = await query(
        `SELECT id, contact_name, phone, address, city, type, is_default
         FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, id DESC`,
        [id]
      );
      deliveryAddresses = addrRes.rows.map((c: any) => ({
        id: c.id,
        name: c.contact_name || 'Địa chỉ nhận hàng',
        type: c.type || 'delivery',
        address: [c.address, c.city].filter(Boolean).join(', ') || '—',
        phone: c.phone || '—',
      }));
    } catch (err) {
      console.warn('[Admin Customer Detail] Addresses query failed:', err);
    }

    // Lịch sử đơn hàng từ PostgreSQL orders
    let recentOrders: any[] = [];
    let totalRevenue = Number(partner.cumulative_sales || 0);
    let totalOrders = 0;
    let aov = 0;
    let lastOrderDate = '—';

    try {
      const ordRes = await query(
        `SELECT id, order_code, client_order_ref, amount_untaxed, amount_total, paid_amount, status, payment_status,
                COALESCE(date_order, created_at) as date_order
         FROM orders WHERE customer_id = $1 ORDER BY COALESCE(date_order, created_at) DESC LIMIT 100`,
        [id]
      );
      const orders = ordRes.rows;
      const confirmed = orders.filter((o: any) =>
        ['confirmed', 'delivered', 'completed', 'sale', 'done'].includes(o.status)
      );
      totalOrders = confirmed.length;
      const calcRevenue = confirmed.reduce(
        (sum: number, o: any) => sum + (Number(o.amount_total ?? o.amount_untaxed) || 0),
        0
      );
      totalRevenue = Math.max(totalRevenue, calcRevenue);
      aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      if (orders.length > 0 && orders[0].date_order) {
        lastOrderDate = new Date(orders[0].date_order).toISOString().split('T')[0];
      }

      recentOrders = orders.slice(0, 8).map((o: any) => ({
        id: o.id,
        name: o.order_code || `ORD-${o.id}`,
        client_order_ref: o.client_order_ref || '',
        date: o.date_order ? new Date(o.date_order).toISOString().split('T')[0] : '—',
        amount: Number(o.amount_total || 0),
        amount_untaxed: Number(o.amount_untaxed || o.amount_total || 0),
        paid_amount: Number(o.paid_amount || 0),
        state: o.status || 'draft',
        status: o.status || 'draft',
        payment_status: o.payment_status || 'unpaid',
      }));
    } catch (err) {
      console.warn('[Admin Customer Detail] Orders query failed:', err);
    }

    const tierStats = computeDealerTierMetrics(totalRevenue);

    // Progressive enrichment từ Directus dealer_registrations
    let dealerRegistration: any = null;
    try {
      const phoneClean = (partner.phone || '').replace(/\s+/g, '');
      const emailClean = (partner.email || '').toLowerCase().trim();
      if (phoneClean || emailClean) {
        const orClauses: any[] = [];
        if (phoneClean) orClauses.push({ phone: { _eq: phoneClean } });
        if (emailClean) orClauses.push({ email: { _eq: emailClean } });

        const regs = await directusAdmin.request(
          readItems('dealer_registrations' as any, {
            filter: { _or: orClauses },
            limit: 1,
          })
        );
        if (regs && regs.length > 0) {
          const r = regs[0];
          dealerRegistration = {
            id: r.id,
            store_name: r.store_name || '—',
            business_model: r.business_model || '—',
            city: r.city || r.city_province || '—',
            status: r.status || 'pending',
            created_at: r.created_at || r.date_created || '',
            note: r.note || r.notes || '',
          };
        }
      }
    } catch {
      // Directus không bắt buộc
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: partner.id,
          name: partner.name || 'Chưa đặt tên',
          ref: partner.code || `DL-${partner.id}`,
          vat: '—',
          company_name: partner.name || '—',
          is_company: true,
          phone: partner.phone || '—',
          email: partner.email || '—',
          street: [partner.address, partner.city].filter(Boolean).join(', ') || '—',
          city: partner.city || '—',
          active: partner.is_active !== false,
          has_password: Boolean(partner.has_password),
          comment: '',
          deliveryAddresses,
          dealerRegistration,
          salesSummary: {
            totalRevenue,
            totalOrders,
            aov,
            lastOrderDate,
            ...tierStats,
          },
          recentOrders,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Customer Detail Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi đọc chi tiết đại lý' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = Number(params.id);
    if (!id || isNaN(id) || id <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã đại lý không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const sets: string[] = [];
    const values: any[] = [];

    const pushField = (col: string, val: any) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };

    if (body.name !== undefined && String(body.name).trim()) pushField('name', String(body.name).trim());
    if (body.ref !== undefined) pushField('code', String(body.ref).trim() || null);
    if (body.phone !== undefined) pushField('phone', String(body.phone).trim() || null);
    if (body.email !== undefined) pushField('email', String(body.email).trim() || null);
    if (body.street !== undefined) pushField('address', String(body.street).trim() || null);
    if (body.city !== undefined) pushField('city', String(body.city).trim() || null);
    if (body.active !== undefined) pushField('is_active', Boolean(body.active));
    if (body.tier !== undefined) pushField('tier', String(body.tier).trim());
    if (body.password !== undefined && String(body.password).trim()) {
      const pwd = String(body.password).trim();
      if (pwd.length < 6) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mật khẩu phải có tối thiểu 6 ký tự' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      pushField('password_hash', hashPassword(pwd));
    }

    if (sets.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không có trường nào cần cập nhật' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    values.push(id);
    await query(
      `UPDATE customers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật hồ sơ đại lý thành công',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Customer PATCH Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Không thể cập nhật đại lý' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
