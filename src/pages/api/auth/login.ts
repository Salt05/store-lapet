// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';
import { customerService } from '@/services/customer.service';
import { verifyPassword, createAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, session, cookies }) => {
  try {
    const body = await request.json();
    const identifier = body?.identifier?.trim();
    const password = body?.password;

    if (!identifier || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng nhập số điện thoại/email và mật khẩu.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partner = await customerService.findPartnerByPhoneOrEmail(identifier);

    if (!partner || partner.active === false || partner.is_active === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tài khoản không tồn tại hoặc đã bị tạm khóa.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!partner.password_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tài khoản chưa thiết lập mật khẩu. Vui lòng đăng nhập bằng mã OTP hoặc liên hệ quản trị viên để cấp mật khẩu.',
          requireOtp: true,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isValid = verifyPassword(password, partner.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mật khẩu không chính xác. Vui lòng thử lại.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Lưu Astro Session
    if (session) {
      await session.regenerate();
      await session.set('partner_id', partner.id);
      await session.set('partner_name', partner.name ?? null);
      await session.set('partner_email', partner.email ?? null);
      await session.set('partner_phone', partner.phone ?? null);
    }

    // 2. Thiết lập HMAC token cookie
    const authToken = createAuthToken({
      partnerId: partner.id,
      partnerName: partner.name || null,
      partnerPhone: partner.phone || null,
    });

    cookies.set(AUTH_COOKIE_NAME, authToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
    });

    // 3. Client helper cookies cho Alpine.js
    const cookieOptions = {
      path: '/',
      httpOnly: false,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7,
    };
    cookies.set('partner_id', String(partner.id), cookieOptions);
    cookies.set('partner_name', String(partner.name || ''), cookieOptions);
    cookies.set('partner_phone', String(partner.phone || ''), cookieOptions);
    cookies.set('session_id', `partner_session_${partner.id}`, { ...cookieOptions, httpOnly: true });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đăng nhập thành công!',
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          phone: partner.phone,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API Auth Login Exception]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi đăng nhập.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
