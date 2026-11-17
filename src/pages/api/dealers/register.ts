import type { APIRoute } from 'astro';
import { directusAdmin } from '@/lib/directus';
import { createItem } from '@directus/sdk';
import type { DealerRegistrationResponse } from '@/types/api';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export const prerender = false;

// Regex kiểm tra số điện thoại Việt Nam (10 chữ số bắt đầu bằng 03, 05, 07, 08, 09)
const VN_PHONE_REGEX = /^(0[35789])[0-9]{8}$/;

// Regex kiểm tra địa chỉ email cơ bản theo RFC
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, any> = {};

    if (contentType.includes('application/json')) {
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      try {
        payload = await request.json();
      } catch {
        try {
          const formData = await request.formData();
          payload = Object.fromEntries(formData.entries());
        } catch {
          payload = {};
        }
      }
    }

    // 1. Kiểm tra honeypot anti-spam (_honey)
    if (payload._honey && String(payload._honey).trim() !== '') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đăng ký đại lý thành công! Đội ngũ LA PET sẽ liên hệ trong 24h làm việc.',
        } satisfies DealerRegistrationResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Chuẩn hóa và ánh xạ các trường dữ liệu (hỗ trợ cả chuẩn English và form tiếng Việt)
    const name = (
      payload.name ||
      payload.full_name ||
      payload['Họ và tên'] ||
      payload['ho_va_ten'] ||
      ''
    ).toString().trim();

    let rawPhone = (
      payload.phone ||
      payload['Số điện thoại'] ||
      payload['so_dien_thoai'] ||
      ''
    ).toString().trim();

    const password = (
      payload.password ||
      payload.mat_khau ||
      payload['Mật khẩu'] ||
      payload['matkhau'] ||
      ''
    ).toString();

    const store_name = (
      payload.store_name ||
      payload['Tên cửa hàng'] ||
      payload['ten_cua_hang'] ||
      ''
    ).toString().trim();

    const business_model = (
      payload.business_model ||
      payload['Mô hình kinh doanh'] ||
      payload['mo_hinh_kinh_doanh'] ||
      ''
    ).toString().trim();

    const city_province = (
      payload.city ||
      payload.city_province ||
      payload['Địa chỉ Tỉnh/Thành'] ||
      payload['dia_chi_tinh_thanh'] ||
      payload['Khu vực'] ||
      ''
    ).toString().trim();

    const email = (
      payload.email ||
      payload['Email'] ||
      ''
    ).toString().trim();

    const notes = (
      payload.note ||
      payload.notes ||
      payload['Ghi chú'] ||
      payload['ghi_chu'] ||
      ''
    ).toString().trim();

    // 3. Xác thực dữ liệu đầu vào (Validation)
    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Họ và tên người đại diện là bắt buộc (tối thiểu 2 ký tự).',
          message: 'Họ và tên người đại diện là bắt buộc (tối thiểu 2 ký tự).',
        } satisfies DealerRegistrationResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Chuẩn hóa số điện thoại: bỏ khoảng trắng, dấu gạch nối, dấu chấm, dấu ngoặc
    let cleanedPhone = rawPhone.replace(/[\s\-\.\(\)]/g, '');
    if (cleanedPhone.startsWith('+84')) {
      cleanedPhone = '0' + cleanedPhone.slice(3);
    } else if (cleanedPhone.startsWith('84') && cleanedPhone.length === 11) {
      cleanedPhone = '0' + cleanedPhone.slice(2);
    }

    if (!VN_PHONE_REGEX.test(cleanedPhone)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam hợp lệ (vd: 0909 203 166).',
          message: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam hợp lệ (vd: 0909 203 166).',
        } satisfies DealerRegistrationResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!business_model) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Vui lòng chọn mô hình kinh doanh.',
          message: 'Vui lòng chọn mô hình kinh doanh.',
        } satisfies DealerRegistrationResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Địa chỉ email không đúng định dạng.',
          message: 'Địa chỉ email không đúng định dạng.',
        } satisfies DealerRegistrationResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password && password.length < 6) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Mật khẩu phải có tối thiểu 6 ký tự.',
          message: 'Mật khẩu phải có tối thiểu 6 ký tự.',
        } satisfies DealerRegistrationResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Lưu vào Directus collection `dealer_registrations`
    const now = new Date().toISOString();
    const recordPayload = {
      name,
      full_name: name,
      phone: cleanedPhone,
      store_name: store_name || null,
      business_model,
      city: city_province || null,
      city_province: city_province || null,
      email: email || null,
      note: notes || null,
      notes: notes || null,
      status: 'pending',
      created_at: now,
    };

    let createdRecord: any;
    try {
      createdRecord = await directusAdmin.request(
        createItem('dealer_registrations', recordPayload)
      );
    } catch (dbErr: any) {
      console.error('[API Dealer Register DB Error]:', dbErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lỗi hệ thống khi lưu thông tin đại lý. Vui lòng liên hệ Hotline: 0909 203 166.',
          message: 'Lỗi hệ thống khi lưu thông tin đại lý. Vui lòng liên hệ Hotline: 0909 203 166.',
        } satisfies DealerRegistrationResponse),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Khởi tạo hoặc cập nhật tài khoản khách hàng trong PostgreSQL customers nếu có mật khẩu
    if (password) {
      try {
        const passwordHash = hashPassword(password);
        let existingCustomer: any = null;

        if (cleanedPhone) {
          const r = await query(
            `SELECT id, code, name, phone, email, is_active FROM customers WHERE phone = $1 LIMIT 1`,
            [cleanedPhone]
          );
          if (r.rows && r.rows.length > 0) existingCustomer = r.rows[0];
        }

        if (!existingCustomer && email) {
          const r = await query(
            `SELECT id, code, name, phone, email, is_active FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [email]
          );
          if (r.rows && r.rows.length > 0) existingCustomer = r.rows[0];
        }

        if (existingCustomer) {
          await query(
            `UPDATE customers 
             SET password_hash = $1, 
                 name = COALESCE(NULLIF($2, ''), name), 
                 city = COALESCE(NULLIF($3, ''), city), 
                 is_active = TRUE, 
                 updated_at = NOW()
             WHERE id = $4`,
            [passwordHash, name, city_province || null, existingCustomer.id]
          );
        } else {
          let dealerCode = `DL-${new Date().getFullYear()}-0001`;
          try {
            const codeRes = await query(`SELECT COUNT(*) as count FROM customers WHERE code LIKE 'DL-%'`);
            const count = Number(codeRes?.rows[0]?.count || 0) + 1;
            dealerCode = `DL-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
          } catch {
            dealerCode = `DL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
          }

          const finalName = store_name && store_name !== name ? `${store_name} (${name})` : name;
          await query(
            `INSERT INTO customers (
              code, name, phone, email, address, city,
              tier, cumulative_sales, is_active, password_hash, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              'STANDARD', 0, TRUE, $7, NOW(), NOW()
            )`,
            [dealerCode, finalName, cleanedPhone, email || null, city_province || null, city_province || null, passwordHash]
          );
        }
      } catch (pgErr: any) {
        console.warn('[API Dealer Register Postgres Error]:', pgErr?.message || pgErr);
      }
    }

    // 5. Gửi thông báo quản trị viên qua email-otp-service (Fault Tolerant, không làm đứt đoạn phản hồi)
    const rawUrl =
      (typeof process !== 'undefined' && process.env?.EMAIL_OTP_SERVICE_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.EMAIL_OTP_SERVICE_URL) ||
      'http://127.0.0.1:4000';
    let baseUrl = rawUrl.trim().replace(/\/+$/, '');
    if (baseUrl.startsWith('http://localhost:')) {
      baseUrl = baseUrl.replace('http://localhost:', 'http://127.0.0.1:');
    }
    const notifyUrl = `${baseUrl}/api/notify-admin`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dealer_registration',
          title: 'Đăng ký đại lý B2B mới',
          data: {
            name,
            phone: cleanedPhone,
            store_name: store_name || '',
            business_model,
            city: city_province || '',
            email: email || '',
            note: notes || '',
          },
        }),
        signal: controller.signal,
      })
        .then((res) => {
          clearTimeout(timeoutId);
          if (!res.ok) {
            console.warn(`[Register Dealer] email-otp-service phản hồi status ${res.status}`);
          }
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          console.warn('[Register Dealer] Không thể kết nối email-otp-service (lead đã được bảo lưu an toàn):', err?.message || err);
        });
    } catch (e: any) {
      console.warn('[Register Dealer] Cảnh báo gửi thông báo email:', e?.message || e);
    }

    // 6. Phản hồi thành công cho Client
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đăng ký đại lý thành công! Đội ngũ LA PET sẽ liên hệ trong 24h làm việc.',
        id: createdRecord?.id,
      } satisfies DealerRegistrationResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Dealer Register Exception]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Lỗi máy chủ khi xử lý đăng ký đại lý. Vui lòng liên hệ Hotline: 0909 203 166.',
        message: 'Lỗi máy chủ khi xử lý đăng ký đại lý. Vui lòng liên hệ Hotline: 0909 203 166.',
      } satisfies DealerRegistrationResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
