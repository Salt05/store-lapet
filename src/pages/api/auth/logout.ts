import type { APIRoute } from 'astro';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ session, cookies }) => {
  try {
    if (session) {
      await session.destroy();
    }

    // Xóa sạch cookie auth
    cookies.delete(AUTH_COOKIE_NAME, { path: '/' });
    cookies.delete('partner_id', { path: '/' });
    cookies.delete('partner_name', { path: '/' });
    cookies.delete('partner_phone', { path: '/' });
    cookies.delete('session_id', { path: '/' });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã đăng xuất thành công',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('[AUTH LOGOUT ERROR]:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Không thể đăng xuất',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};