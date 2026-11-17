// src/pages/api/admin/products/index.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';

export const prerender = false;

function resolveProductImage(imageUrl?: string | null): string {
  if (!imageUrl || !String(imageUrl).trim()) return '/images/placeholder-product.svg';
  return String(imageUrl).trim();
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get('q') || '').slice(0, 200).trim();
    const status = (url.searchParams.get('status') || '').trim();
    const category = (url.searchParams.get('category') || '').trim();
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 200)), 500);

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`p.category = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const res = await query(
      `SELECT
         p.id, p.sku, p.name, p.slug, p.price, p.wholesale_price,
         p.unit, p.weight, p.category, p.image_url, p.status,
         p.is_active, p.sold_quantity, p.updated_at,
         inv.available AS stock_available,
         inv.on_hand AS stock_on_hand,
         inv.min_stock AS stock_min
       FROM products p
       LEFT JOIN inventory_items inv
         ON p.id = inv.product_id OR UPPER(TRIM(p.sku)) = UPPER(TRIM(inv.sku))
       ${whereClause}
       ORDER BY p.id ASC
       LIMIT $${params.length}`,
      params
    );

    const normalized = res.rows.map((p: any) => {
      const price = Number(p.price) || 0;
      const wholesale = Number(p.wholesale_price) || Math.round(price * 0.78);
      return {
        id: p.id,
        name: p.name || 'Sản phẩm LA PET',
        slug: p.slug || String(p.id),
        sku: p.sku || '—',
        price,
        wholesale_price: wholesale,
        status: p.status || 'published',
        is_active: p.is_active !== false,
        sold_quantity: Number(p.sold_quantity) || 0,
        specification: p.unit || (p.weight ? `${p.weight}g` : '—'),
        unit: p.unit || 'Đơn vị',
        weight: p.weight ? Number(p.weight) : null,
        category: p.category || null,
        category_id: p.category || null,
        category_name: p.category || 'Chưa phân loại',
        brand: 'LA PET',
        image: p.image_url || null,
        image_url: resolveProductImage(p.image_url),
        stock_available: p.stock_available !== null && p.stock_available !== undefined ? Number(p.stock_available) : null,
        stock_on_hand: p.stock_on_hand !== null && p.stock_on_hand !== undefined ? Number(p.stock_on_hand) : null,
        stock_min: p.stock_min !== null && p.stock_min !== undefined ? Number(p.stock_min) : 10,
      };
    });

    return new Response(
      JSON.stringify({ success: true, data: normalized, total: normalized.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi truy vấn sản phẩm PostgreSQL' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const sku = String(body.sku || '').trim();
    const name = String(body.name || '').trim();
    if (!sku || !name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã SKU hoặc tên sản phẩm' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const price = Math.max(0, Number(body.price) || 0);
    const wholesalePrice = body.wholesale_price !== undefined ? Math.max(0, Number(body.wholesale_price) || 0) : Math.round(price * 0.78);
    const unit = String(body.specification || body.unit || 'Đơn vị').trim();
    const category = body.category ? String(body.category).trim() : null;
    const status = String(body.status || 'published').trim();
    const slug = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    const res = await query(
      `INSERT INTO products (sku, name, slug, price, wholesale_price, unit, category, status, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [sku, name, slug, price, wholesalePrice, unit, category, status, body.image_url || null]
    );

    return new Response(
      JSON.stringify({ success: true, data: res.rows[0] }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi tạo mới sản phẩm' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu JSON không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id, name, specification, unit, price, wholesale_price, sku, status, category, image_url } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu id sản phẩm' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined && String(name).trim()) {
      params.push(String(name).trim());
      updates.push(`name = $${params.length}`);
    }
    const specValue = specification !== undefined ? specification : unit;
    if (specValue !== undefined) {
      params.push(String(specValue).trim() || 'Đơn vị');
      updates.push(`unit = $${params.length}`);
    }
    if (price !== undefined && price !== null) {
      params.push(Number(price));
      updates.push(`price = $${params.length}`);
    }
    if (wholesale_price !== undefined && wholesale_price !== null) {
      params.push(Number(wholesale_price));
      updates.push(`wholesale_price = $${params.length}`);
    }
    if (sku !== undefined && String(sku).trim()) {
      params.push(String(sku).trim());
      updates.push(`sku = $${params.length}`);
    }
    if (status !== undefined) {
      const nextStatus = String(status).trim();
      params.push(nextStatus);
      updates.push(`status = $${params.length}`);
      params.push(nextStatus === 'published');
      updates.push(`is_active = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(category ? String(category).trim() : null);
      updates.push(`category = $${params.length}`);
    }
    if (image_url !== undefined) {
      params.push(image_url ? String(image_url).trim() : null);
      updates.push(`image_url = $${params.length}`);
    }

    if (updates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không có trường nào cần cập nhật' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    updates.push(`updated_at = NOW()`);
    params.push(Number(id));

    const res = await query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (res.rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy sản phẩm để cập nhật' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: res.rows[0] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi cập nhật sản phẩm PostgreSQL' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
