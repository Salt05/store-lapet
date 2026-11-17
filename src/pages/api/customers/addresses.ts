// src/pages/api/customers/addresses.ts
import type { APIRoute } from 'astro';
import { query, withTransaction } from '@/lib/db';

export const prerender = false;

function jsonResponse(data: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ locals }) => {
  const { isAuthenticated, isDealer, partnerId } = locals.auth || {};
  const customerId = Number(partnerId);
  if (!isAuthenticated || !isDealer || !Number.isInteger(customerId) || customerId <= 0) {
    return jsonResponse({ success: false, error: 'Chưa đăng nhập đại lý' }, 401);
  }

  try {
    const res = await query(
      `SELECT id, customer_id, contact_name, phone, address, city, type, is_default, created_at
       FROM customer_addresses
       WHERE customer_id = $1
       ORDER BY is_default DESC, id DESC`,
      [customerId]
    );
    return jsonResponse({ success: true, addresses: res.rows });
  } catch (err: any) {
    console.error('[API Customer Addresses GET]:', err);
    return jsonResponse({ success: false, error: err?.message || 'Lỗi truy vấn sổ địa chỉ' }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { isAuthenticated, isDealer, partnerId } = locals.auth || {};
  const customerId = Number(partnerId);
  if (!isAuthenticated || !isDealer || !Number.isInteger(customerId) || customerId <= 0) {
    return jsonResponse({ success: false, error: 'Chưa đăng nhập đại lý' }, 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const contactName = String(body.contact_name || '').trim();
    const phone = String(body.phone || '').trim();
    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const type = String(body.type || 'delivery').trim();
    const isDefault = Boolean(body.is_default);

    if (!address || address.length < 5) {
      return jsonResponse({ success: false, error: 'Địa chỉ giao hàng không hợp lệ (tối thiểu 5 ký tự)' }, 400);
    }

    const created = await withTransaction(async (client) => {
      if (isDefault) {
        await client.query(`UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1`, [customerId]);
      }

      const res = await client.query(
        `INSERT INTO customer_addresses (customer_id, contact_name, phone, address, city, type, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, customer_id, contact_name, phone, address, city, type, is_default`,
        [customerId, contactName || null, phone || null, address, city || null, type, isDefault]
      );
      return res.rows[0];
    });

    return jsonResponse({ success: true, address: created }, 201);
  } catch (err: any) {
    console.error('[API Customer Addresses POST]:', err);
    return jsonResponse({ success: false, error: err?.message || 'Lỗi lưu địa chỉ mới' }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const { isAuthenticated, isDealer, partnerId } = locals.auth || {};
  const customerId = Number(partnerId);
  if (!isAuthenticated || !isDealer || !Number.isInteger(customerId) || customerId <= 0) {
    return jsonResponse({ success: false, error: 'Chưa đăng nhập đại lý' }, 401);
  }

  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const body = idParam ? null : await request.json().catch(() => ({}));
    const addressId = Number(idParam || body?.id);

    if (!Number.isInteger(addressId) || addressId <= 0) {
      return jsonResponse({ success: false, error: 'Mã địa chỉ không hợp lệ' }, 400);
    }

    const res = await query(
      `DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2 RETURNING id`,
      [addressId, customerId]
    );

    if (res.rowCount === 0) {
      return jsonResponse({ success: false, error: 'Không tìm thấy địa chỉ thuộc đại lý' }, 404);
    }

    return jsonResponse({ success: true, deletedId: addressId });
  } catch (err: any) {
    console.error('[API Customer Addresses DELETE]:', err);
    return jsonResponse({ success: false, error: err?.message || 'Lỗi xóa địa chỉ' }, 500);
  }
};

