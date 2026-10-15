import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  if (!supabase) {
    return redirect('/auth/login?error=SupabaseNotConfigured');
  }

  const authCode = url.searchParams.get('code');

  // 1. Nếu có mã xác thực gửi về từ Supabase OAuth
  if (authCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (!error && data.session) {
      // Lưu access_token và refresh_token vào Cookie phía Client/Server
      cookies.set('sb-access-token', data.session.access_token, {
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      });
      cookies.set('sb-refresh-token', data.session.refresh_token, {
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      });

      // 2. Chuyển hướng người dùng về Trang chủ sau khi đăng nhập thành công
      return redirect('/');
    }
  }

  // Nếu gặp lỗi hoặc không có code, trả về trang login kèm thông báo
  return redirect('/auth/login?error=OAuthCallbackFailed');
};
