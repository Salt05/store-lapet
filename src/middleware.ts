import { defineMiddleware } from 'astro:middleware';
import { getAuthState, getAdminAuthState } from './lib/auth';

try {
  if (typeof (process as any).loadEnvFile === 'function') {
    (process as any).loadEnvFile();
  }
} catch {
  // Safe ignore nếu môi trường đã có biến hoặc file .env đã nạp
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.auth = await getAuthState(context);
  context.locals.adminAuth = await getAdminAuthState(context);

  const pathname = context.url.pathname;

  // Bảo vệ route Admin Dashboard
  if (pathname.startsWith('/admin')) {
    const isLoginRoute = pathname === '/admin/login' || pathname === '/admin/login/';
    if (!context.locals.adminAuth?.isAdmin) {
      if (!isLoginRoute) {
        return context.redirect('/admin/login');
      }
    } else {
      if (isLoginRoute) {
        return context.redirect('/admin');
      }
    }
  }

  // Bảo vệ API Admin
  if (pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth/')) {
    if (!context.locals.adminAuth?.isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Yêu cầu quyền Quản trị viên' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  const response = await next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=()'
  );

  const cspPolicy = [
    "default-src 'self'",
    "img-src 'self' data: https: http:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: http: wss:",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set(
    'Content-Security-Policy',
    cspPolicy
  );

  return response;
});