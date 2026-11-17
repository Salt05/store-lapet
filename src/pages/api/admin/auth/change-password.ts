// src/pages/api/admin/auth/change-password.ts
import type { APIRoute } from 'astro';
import { getAdminAuthState } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const adminAuth = await getAdminAuthState({ cookies });
    if (!adminAuth.isAdmin || !adminAuth.adminId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa đăng nhập quyền quản trị' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword !== confirmPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Xác nhận mật khẩu mới không khớp' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const directusUrl = process.env.DIRECTUS_URL || 'http://127.0.0.1:8055';
    const directusAdminToken = process.env.DIRECTUS_ADMIN_TOKEN || 'lapet_admin_dev_token_2026';

    // 1. Kiểm tra mật khẩu hiện tại với Directus Auth
    try {
      const verifyRes = await fetch(`${directusUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminAuth.adminEmail,
          password: currentPassword,
        }),
      });

      if (!verifyRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mật khẩu hiện tại không chính xác' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (checkErr: any) {
      console.warn('[Admin Change Password] Directus verify check error:', checkErr.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể xác thực với Directus Auth: ' + checkErr.message }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Cập nhật mật khẩu mới cho user trong Directus
    const updateRes = await fetch(`${directusUrl}/users/${adminAuth.adminId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${directusAdminToken}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!updateRes.ok) {
      const errJson = await updateRes.json().catch(() => ({}));
      const errMsg = errJson?.errors?.[0]?.message || 'Không thể cập nhật mật khẩu Directus';
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đổi mật khẩu Quản trị viên thành công!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Admin Change Password Exception]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Lỗi máy chủ khi đổi mật khẩu' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
