// src/pages/api/admin/auth/logout.ts
import type { APIRoute } from 'astro';
import { ADMIN_COOKIE_NAME } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE_NAME, {
    path: '/',
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Đăng xuất thành công' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
