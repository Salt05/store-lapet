import type { APIRoute } from 'astro';
import { getRouterUrl } from '@/services/router-client';

export const prerender = false;

export const GET: APIRoute = async () => {
  const routerBaseUrl = getRouterUrl();
  const endpoint = `${routerBaseUrl}/health`;

  const startTime = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - startTime;
    const data = await response.json();

    if (response.ok) {
      return new Response(
        JSON.stringify({
          connected: true,
          status: 'SUCCESS',
          router_url: routerBaseUrl,
          latency_ms: latencyMs,
          router_response: data,
          message: 'Kết nối tới Router trung tâm thành công!',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          connected: false,
          status: 'ERROR',
          router_url: routerBaseUrl,
          http_status: response.status,
          latency_ms: latencyMs,
          router_response: data,
          message: 'Router phản hồi nhưng trả về mã lỗi HTTP',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return new Response(
      JSON.stringify({
        connected: false,
        status: 'DISCONNECTED',
        router_url: routerBaseUrl,
        latency_ms: latencyMs,
        error: error?.message || 'Không thể kết nối đến Router',
        help: 'Vui lòng kiểm tra Docker hoặc tiến trình ocms-router trên cổng 3001 đã được khởi động chưa.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
