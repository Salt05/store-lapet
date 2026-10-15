// src/pages/api/auth/verify-otp.ts
import type { APIRoute } from 'astro';
import { customerService } from '@/services/customer.service';

export const prerender = false;

export const POST: APIRoute = async ({ request, session, cookies }) => {
  try {
    const body = await request.json();
    const identifier = body?.identifier?.trim();
    const otp = body?.otp?.trim();

    // 1. Kiểm tra đầu vào
    if (!identifier || !otp) {
      return new Response(
        JSON.stringify({ error: 'Vui lòng nhập đầy đủ thông tin và mã OTP.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Tra cứu dữ liệu Đại lý từ Odoo để lấy Email chính xác
    const partner = await customerService.findPartnerByPhoneOrEmail(identifier);

    if (!partner || partner.active === false) {
      return new Response(
        JSON.stringify({ error: 'Dữ liệu đại lý không tồn tại hoặc đã bị khóa.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!partner.email) {
      return new Response(
        JSON.stringify({ error: 'Tài khoản chưa cập nhật Email trên Odoo. Vui lòng liên hệ Hotline.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Chuẩn hóa URL & Endpoint của Microservice xác thực OTP
    const rawUrl =
      (typeof process !== 'undefined' && process.env?.EMAIL_OTP_SERVICE_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.EMAIL_OTP_SERVICE_URL) ||
      'http://127.0.0.1:4000';
    let baseUrl = rawUrl.trim().replace(/\/+$/, '');
    if (baseUrl.startsWith('http://localhost:')) {
      baseUrl = baseUrl.replace('http://localhost:', 'http://127.0.0.1:');
    }
    const targetUrl = `${baseUrl}/api/verify-otp`;

    const targetEmail = partner.email.trim().toLowerCase();

    // 4. Gọi sang Microservice xác thực OTP
    let verifyRes: Response;
    try {
      verifyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          otp: otp,
        }),
      });
    } catch (fetchError: any) {
      console.error('[API Verify-OTP Network Error] Không thể kết nối tới Email OTP Service:', fetchError?.message || fetchError);
      return new Response(
        JSON.stringify({ error: 'Không thể kết nối đến máy chủ xác thực OTP. Vui lòng đảm bảo dịch vụ email-otp-service đang chạy.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Parse phản hồi an toàn
    const responseText = await verifyRes.text();
    let verifyData: any = {};

    try {
      verifyData = JSON.parse(responseText);
    } catch (e) {
      console.error('[API Verify-OTP Error] Response không phải JSON:', responseText);
      return new Response(
        JSON.stringify({ error: 'Không thể xử lý phản hồi từ dịch vụ OTP.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!verifyRes.ok || !verifyData.success) {
      return new Response(
        JSON.stringify({ error: verifyData.message || verifyData.error || 'Mã OTP không đúng hoặc đã hết hạn.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Cấu hình Cookie Options cho Browser[cite: 1]
    const cookieOptions = {
      path: '/',
      httpOnly: false, // Để JavaScript Client (Alpine.js) đọc được
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 ngày[cite: 1]
    };

    const secureCookieOptions = {
      ...cookieOptions,
      httpOnly: true, // Bảo mật session token
    };

    // 7. Lưu Astro Session
    if (session) {
      await session.regenerate();
      await session.set('partner_id', partner.id);
      await session.set('partner_name', partner.name ?? null);
      await session.set('partner_email', partner.email ?? null);
      await session.set('partner_phone', partner.phone ?? partner.mobile ?? null);
    }

    // 8. Thiết lập Browser Cookies
    cookies.set('partner_id', String(partner.id), cookieOptions);
    cookies.set('partner_name', String(partner.name || ''), cookieOptions);
    cookies.set('partner_phone', String(partner.phone || partner.mobile || ''), cookieOptions);
    cookies.set(
      'session_id',
      String(partner.session_id || `partner_session_${partner.id}`),
      secureCookieOptions
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đăng nhập thành công!',
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[API Verify-OTP Exception]:', error);
    return new Response(
      JSON.stringify({ error: 'Lỗi máy chủ khi xác thực OTP.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};