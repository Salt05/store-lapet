import { defineMiddleware } from 'astro:middleware';
import { getAuthState } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  /**
   * P0 AUTH
   *
   * Astro Session
   *      ↓
   * getAuthState()
   *      ↓
   * Astro.locals.auth
   */
  context.locals.auth = await getAuthState(context);

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