// src/pages/api/admin/auth/login.ts
import type { APIRoute } from 'astro';
import { createAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng nhập email và mật khẩu' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const directusUrl = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';

    // Xác thực tài khoản với Directus Auth API
    let adminUser = null;

    try {
      const loginRes = await fetch(`${directusUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(email).trim(), password }),
      });

      if (loginRes.ok) {
        const loginData = await loginRes.json();
        const accessToken = loginData?.data?.access_token;

        // Lấy thông tin user profile
        const userRes = await fetch(`${directusUrl}/users/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (userRes.ok) {
          const userData = (await userRes.json())?.data;
          adminUser = {
            id: userData?.id || 'admin-1',
            email: userData?.email || email,
            name: `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Quản trị viên',
            role: 'admin',
          };
        }
      }
    } catch (directusErr: any) {
      console.warn('[Admin Login] Directus auth error:', directusErr.message);
    }

    if (!adminUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email hoặc mật khẩu không chính xác' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Tạo JWT HMAC-SHA256 Token
    const token = createAdminToken({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      role: adminUser.role,
      ttlSeconds: 86400, // 24h
    });

    cookies.set(ADMIN_COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 86400,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đăng nhập Quản trị thành công',
        user: adminUser,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Login Exception]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi đăng nhập' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
