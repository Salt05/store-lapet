// src/pages/api/admin/customers/index.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { directusAdmin } from '@/lib/directus';
import { readItems } from '@directus/sdk';

export const prerender = false;

export function computeDealerTierMetrics(cumulativeSales: number) {
  const sales = Math.max(0, Number(cumulativeSales) || 0);
  let tierCode: 'standard' | 'silver' | 'gold' | 'diamond' = 'standard';
  let tierName = 'Đại lý Tiêu chuẩn';
  let discountNonChicken = 5;
  let discountChicken = 7;
  let nextTierTarget = 50_000_000;
  let nextTierName = 'Hạng Bạc (50Tr)';

  if (sales >= 200_000_000) {
    tierCode = 'diamond';
    tierName = 'Kim Cương';
    discountNonChicken = 15;
    discountChicken = 12;
    nextTierTarget = 500_000_000;
    nextTierName = sales >= 500_000_000 ? 'Đã đạt đỉnh (500Tr)' : 'Mốc VIP (500Tr)';
  } else if (sales >= 100_000_000) {
    tierCode = 'gold';
    tierName = 'Hạng Vàng';
    discountNonChicken = 12;
    discountChicken = 10;
    nextTierTarget = 200_000_000;
    nextTierName = 'Kim Cương (200Tr)';
  } else if (sales >= 50_000_000) {
    tierCode = 'silver';
    tierName = 'Hạng Bạc';
    discountNonChicken = 8;
    discountChicken = 9;
    nextTierTarget = 100_000_000;
    nextTierName = 'Hạng Vàng (100Tr)';
  }

  const nextTierNeeded = Math.max(0, nextTierTarget - sales);
  const yearEndBonusEligible = sales >= 100_000_000;
  const yearEndBonusAmount = yearEndBonusEligible ? Math.round(sales * 0.03) : 0;

  return {
    cumulativeSales: sales,
    tierCode,
    tierName,
    discountNonChicken,
    discountChicken,
    discountLabel: `Không gà: ${discountNonChicken}% | Quấn gà: ${discountChicken}%`,
    nextTierTarget,
    nextTierName,
    nextTierNeeded,
    yearEndBonusEligible,
    yearEndBonusAmount,
  };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get('q') || '').trim();
    const status = url.searchParams.get('status') || 'all';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 100);
    const page = Math.max(Number(url.searchParams.get('page') || 1), 1);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (status === 'active') {
      conditions.push(`c.is_active = TRUE`);
    } else if (status === 'inactive' || status === 'blocked') {
      conditions.push(`c.is_active = FALSE`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.code ILIKE $${idx} OR c.email ILIKE $${idx})`);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await query(`SELECT COUNT(*) as total FROM customers c ${whereSql}`, params);
    const totalCount = Number(countRes.rows[0]?.total || 0);

    const dataParams = [...params, limit, offset];
    const custRes = await query(
      `SELECT 
         c.id, c.code, c.name, c.phone, c.email, c.address, c.city,
         c.tier, c.cumulative_sales, c.is_active, c.created_at,
         (c.password_hash IS NOT NULL AND c.password_hash != '') as has_password,
         COALESCE(SUM(CASE WHEN o.status IN ('confirmed', 'delivered', 'completed', 'sale', 'done') THEN o.amount_total ELSE 0 END), 0) as order_sales,
         COUNT(CASE WHEN o.status IN ('confirmed', 'delivered', 'completed', 'sale', 'done') THEN 1 END) as confirmed_orders_count
       FROM customers c
       LEFT JOIN orders o ON c.id = o.customer_id
       ${whereSql}
       GROUP BY c.id
       ORDER BY c.cumulative_sales DESC, c.id DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    // Progressive enrichment từ Directus dealer_registrations nếu có
    let registrations: any[] = [];
    try {
      const regRes = await directusAdmin.request(
        readItems('dealer_registrations' as any, {
          fields: ['id', 'name', 'store_name', 'phone', 'email', 'business_model', 'city', 'status'],
          limit: 100,
          sort: ['-created_at', '-id'],
        })
      );
      registrations = regRes || [];
    } catch {
      // Directus không bắt buộc
    }

    const regByPhone = new Map<string, any>();
    const regByEmail = new Map<string, any>();
    for (const r of registrations) {
      if (r.phone) regByPhone.set(r.phone.replace(/\s+/g, ''), r);
      if (r.email) regByEmail.set(r.email.toLowerCase().trim(), r);
    }

    const mapped = custRes.rows.map((p: any) => {
      const phoneClean = (p.phone || '').replace(/\s+/g, '');
      const emailClean = (p.email || '').toLowerCase().trim();
      const directusDealer = (phoneClean && regByPhone.get(phoneClean)) || (emailClean && regByEmail.get(emailClean)) || null;
      const totalSales = Math.max(Number(p.cumulative_sales || 0), Number(p.order_sales || 0));
      const tierStats = computeDealerTierMetrics(totalSales);

      return {
        id: p.id,
        name: p.name || 'Đại lý chưa đặt tên',
        ref: p.code || `DL-${p.id}`,
        vat: '—',
        phone: p.phone || '—',
        email: p.email || '—',
        street: [p.address, p.city].filter(Boolean).join(', ') || '—',
        city: p.city || '',
        active: p.is_active !== false,
        has_password: Boolean(p.has_password),
        is_company: true,
        confirmedOrdersCount: Number(p.confirmed_orders_count || 0),
        ...tierStats,
        dealerRegistration: directusDealer ? {
          id: directusDealer.id,
          store_name: directusDealer.store_name || directusDealer.name || '—',
          business_model: directusDealer.business_model || '—',
          status: directusDealer.status || 'pending',
          city: directusDealer.city || '—',
        } : null,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: mapped,
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Customers GET Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi tra cứu danh sách đại lý' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, ref, phone, email, street, city, tier, password } = body || {};

    if (!name || !String(name).trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên đại lý là bắt buộc' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone ? String(phone).trim() : null;
    if (cleanPhone) {
      const existing = await query('SELECT id FROM customers WHERE phone = $1 LIMIT 1', [cleanPhone]);
      if (existing.rows.length > 0) {
        return new Response(
          JSON.stringify({ success: false, error: `Số điện thoại ${cleanPhone} đã tồn tại trong hệ thống.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const passwordHash = password && String(password).trim().length >= 6 ? hashPassword(String(password).trim()) : null;
    const dealerCode = ref ? String(ref).trim() : `DL-${Date.now().toString().slice(-6)}`;
    const insertRes = await query(
      `INSERT INTO customers (code, name, phone, email, password_hash, address, city, tier, cumulative_sales, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, TRUE, NOW(), NOW())
       RETURNING id, code, name, phone, email`,
      [
        dealerCode,
        String(name).trim(),
        cleanPhone,
        email ? String(email).trim() : null,
        passwordHash,
        street ? String(street).trim() : null,
        city ? String(city).trim() : null,
        tier || 'STANDARD',
      ]
    );

    const created = insertRes.rows[0];
    return new Response(
      JSON.stringify({
        success: true,
        id: created.id,
        code: created.code,
        message: `Đã tạo mới đại lý ${created.name} (${created.code}) thành công`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Customers POST Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Không thể tạo mới đại lý' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
