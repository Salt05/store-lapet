// src/pages/api/admin/dealers/registrations.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';
import { directusAdmin } from '@/lib/directus';
import { readItem, readItems, updateItem } from '@directus/sdk';

export const prerender = false;

async function upsertApprovedDealerInPostgres(params: {
  phone: string;
  email: string;
  storeName: string;
  contactName: string;
  city: string;
}) {
  const { phone, email, storeName, contactName, city } = params;
  let dealerCode = `DL-${new Date().getFullYear()}-0001`;
  try {
    const codeRes = await query(`SELECT COUNT(*) as count FROM customers WHERE code LIKE 'DL-%'`);
    const count = Number(codeRes?.rows[0]?.count || 0) + 1;
    dealerCode = `DL-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
  } catch {
    dealerCode = `DL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  }

  let existing: any = null;
  if (phone) {
    const r = await query(
      `SELECT id, code, name, phone, email, is_active FROM customers WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    if (r.rows.length > 0) existing = r.rows[0];
  }
  if (!existing && email) {
    const r = await query(
      `SELECT id, code, name, phone, email, is_active FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (r.rows.length > 0) existing = r.rows[0];
  }

  if (existing) {
    const finalCode =
      existing.code && String(existing.code).startsWith('DL-') ? existing.code : dealerCode;
    await query(
      `UPDATE customers
       SET code = $1, is_active = TRUE, tier = COALESCE(tier, 'STANDARD'), updated_at = NOW()
       WHERE id = $2`,
      [finalCode, existing.id]
    );
    return { customer: { ...existing, code: finalCode, is_active: true }, dealerCode: finalCode };
  }

  const finalName =
    storeName && storeName !== '—' && storeName !== contactName
      ? `${storeName} (${contactName || 'Đại lý'})`
      : contactName || storeName || `Đại lý ${phone || email}`;

  const insertRes = await query(
    `INSERT INTO customers (
      code, name, phone, email, address, city,
      tier, cumulative_sales, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      'STANDARD', 0, TRUE, NOW(), NOW()
    ) RETURNING id, code, name, phone, email, is_active`,
    [dealerCode, finalName, phone || null, email || null, city || null, city || null]
  );

  return { customer: insertRes.rows[0], dealerCode };
}

export const GET: APIRoute = async () => {
  try {
    const items = await directusAdmin.request(
      readItems('dealer_registrations' as any, {
        sort: ['-created_at', '-id'],
        limit: 100,
      })
    );

    return new Response(
      JSON.stringify({ success: true, data: items || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, status, notes, note } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu id hồ sơ đăng ký' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const noteVal = note !== undefined ? note : notes;
    const payload: Record<string, any> = {};
    if (status !== undefined) payload.status = status;
    if (noteVal !== undefined) payload.note = noteVal;

    const updated = await directusAdmin.request(
      updateItem('dealer_registrations' as any, id, payload)
    );

    let customerId: number | null = null;
    let dealerCode: string | null = null;
    let customerSynced = false;

    // Khi Admin duyệt đại lý ('approved'), tự động tạo hoặc kích hoạt đại lý trong PostgreSQL customers
    if (status === 'approved') {
      try {
        const reg: any =
          updated && (updated as any).phone
            ? updated
            : await directusAdmin.request(readItem('dealer_registrations' as any, id));

        const res = await upsertApprovedDealerInPostgres({
          phone: String(reg?.phone || '').trim(),
          email: String(reg?.email || '').trim(),
          storeName: String(reg?.store_name || reg?.name || reg?.full_name || 'Đại lý LA PET').trim(),
          contactName: String(reg?.name || reg?.full_name || 'Đại lý LA PET').trim(),
          city: String(reg?.city || reg?.city_province || '').trim(),
        });

        customerId = res.customer?.id ? Number(res.customer.id) : null;
        dealerCode = res.dealerCode;
        customerSynced = Boolean(customerId);
      } catch (pgErr: any) {
        console.warn('[ApproveDealer] Lỗi đồng bộ PostgreSQL customers:', pgErr?.message || pgErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: updated,
        customerId,
        dealerCode,
        customerSynced,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, id, phone: rawPhone, name: reqName, email: reqEmail, store_name, city } = body;

    if (action !== 'approve') {
      return new Response(
        JSON.stringify({ success: false, error: 'Hành động không hợp lệ. Yêu cầu action: "approve"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let phone = rawPhone ? String(rawPhone).trim() : '';
    let email = reqEmail ? String(reqEmail).trim() : '';
    let name = reqName ? String(reqName).trim() : '';
    let storeName = store_name ? String(store_name).trim() : '';
    let cityAddress = city ? String(city).trim() : '';
    let registrationId = id;

    // Nếu có id hoặc phone, cố gắng lấy thêm thông tin từ Directus dealer_registrations
    if (registrationId || phone) {
      try {
        if (registrationId) {
          const reg: any = await directusAdmin.request(readItem('dealer_registrations' as any, registrationId));
          if (reg) {
            if (!phone && reg.phone) phone = String(reg.phone).trim();
            if (!email && reg.email) email = String(reg.email).trim();
            if (!name && (reg.name || reg.full_name)) name = String(reg.name || reg.full_name).trim();
            if (!storeName && reg.store_name) storeName = String(reg.store_name).trim();
            if (!cityAddress && (reg.city || reg.city_province)) cityAddress = String(reg.city || reg.city_province).trim();
          }
        } else if (phone) {
          const regs: any = await directusAdmin.request(readItems('dealer_registrations' as any, {
            filter: { phone: { _eq: phone } },
            limit: 1
          }));
          if (Array.isArray(regs) && regs.length > 0) {
            registrationId = regs[0].id;
            const reg = regs[0];
            if (!email && reg.email) email = String(reg.email).trim();
            if (!name && (reg.name || reg.full_name)) name = String(reg.name || reg.full_name).trim();
            if (!storeName && reg.store_name) storeName = String(reg.store_name).trim();
            if (!cityAddress && (reg.city || reg.city_province)) cityAddress = String(reg.city || reg.city_province).trim();
          }
        }
      } catch (dirErr) {
        console.warn('[ApproveDealer] Lỗi truy vấn Directus registration:', dirErr);
      }
    }

    if (!phone && !registrationId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu số điện thoại hoặc mã hồ sơ đại lý' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Tạo mã đại lý chuẩn DL-...
    // Truy vấn số lượng đại lý hiện có trong PostgreSQL customers để tạo mã tăng dần
    let dealerCode = `DL-${new Date().getFullYear()}-0001`;
    try {
      const codeRes = await query(
        `SELECT COUNT(*) as count FROM customers WHERE code LIKE 'DL-%'`
      );
      const count = Number(codeRes?.rows[0]?.count || 0) + 1;
      dealerCode = `DL-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    } catch (codeErr) {
      dealerCode = `DL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }

    // 2. Kích hoạt hoặc tạo mới đối tác trong PostgreSQL customers
    let customerRow = null;
    try {
      // Kiểm tra xem khách hàng với số điện thoại này đã tồn tại chưa
      const checkRes = await query(
        `SELECT id, code, name, phone, email, is_active FROM customers WHERE phone = $1 LIMIT 1`,
        [phone]
      );

      if (checkRes && checkRes.rows.length > 0) {
        customerRow = checkRes.rows[0];
        // Nếu đã có code bắt đầu bằng DL-, giữ nguyên code đó, nếu không thì cập nhật mã mới
        const finalCode = (customerRow.code && String(customerRow.code).startsWith('DL-'))
          ? customerRow.code
          : dealerCode;

        await query(
          `UPDATE customers 
           SET code = $1, is_active = TRUE, tier = COALESCE(tier, 'STANDARD'), updated_at = NOW()
           WHERE id = $2`,
          [finalCode, customerRow.id]
        );
        dealerCode = finalCode;
      } else {
        // Tạo mới đại lý vào bảng customers
        const finalName = storeName && storeName !== name ? `${storeName} (${name || 'Đại lý'})` : (name || storeName || `Đại lý ${phone}`);
        const insertRes = await query(
          `INSERT INTO customers (
            code, name, phone, email, address, city, 
            tier, cumulative_sales, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            'STANDARD', 0, TRUE, NOW(), NOW()
          ) RETURNING id, code, name, phone, email`,
          [dealerCode, finalName, phone, email || null, cityAddress || null, cityAddress || null]
        );
        customerRow = insertRes?.rows[0];
      }
    } catch (pgErr) {
      console.error('[ApproveDealer] Lỗi cập nhật PostgreSQL customers:', pgErr);
    }

    // 3. Cập nhật trạng thái Directus dealer_registrations sang 'approved'
    if (registrationId) {
      try {
        await directusAdmin.request(
          updateItem('dealer_registrations' as any, registrationId, {
            status: 'approved',
            note: 'Đã duyệt & kích hoạt tài khoản đại lý (' + dealerCode + ')',
          })
        );
      } catch (dirUpdateErr) {
        console.warn('[ApproveDealer] Lỗi cập nhật Directus status:', dirUpdateErr);
      }
    }

    // 4. Gửi email thông báo chào mừng qua email-otp-service nếu có email
    if (email) {
      try {
        const rawUrl =
          (typeof process !== 'undefined' && process.env?.EMAIL_OTP_SERVICE_URL) ||
          'http://127.0.0.1:4000';
        const baseUrl = rawUrl.trim().replace(/\/+$/, '');
        fetch(`${baseUrl}/api/notify-admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'dealer_approved',
            title: `Đại lý ${dealerCode} đã được kích hoạt`,
            data: { code: dealerCode, phone, email }
          })
        }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        code: dealerCode,
        dealer_code: dealerCode,
        message: 'Đã duyệt và kích hoạt tài khoản đại lý thành công',
        data: {
          code: dealerCode,
          dealer_code: dealerCode,
          phone,
          customer: customerRow
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[ApproveDealer Exception]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

