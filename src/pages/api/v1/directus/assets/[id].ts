import type { APIRoute } from 'astro';
import { getDirectusUrl } from '@/lib/catalog';

export const prerender = false;

const SAFE_ASSET_ID = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_TRANSFORM_PARAMS = ['width', 'height', 'fit', 'quality', 'format'] as const;

function detectImageMimeType(buf: Buffer, fallbackType: string | null): string {
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'GIF8') {
    return 'image/gif';
  }
  const head = buf.subarray(0, 64).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml';
  }
  if (fallbackType && fallbackType !== 'application/octet-stream') {
    return fallbackType;
  }
  return 'application/octet-stream';
}

export const GET: APIRoute = async ({ params, url }) => {
  const id = (params.id || '').trim();
  if (!id || !SAFE_ASSET_ID.test(id)) {
    return new Response(null, { status: 400 });
  }

  const directusUrl = getDirectusUrl();
  if (!directusUrl) {
    return new Response(null, { status: 502 });
  }

  const qs = new URLSearchParams();
  for (const key of ALLOWED_TRANSFORM_PARAMS) {
    const val = url.searchParams.get(key);
    if (val) qs.set(key, val);
  }

  const targetUrl = `${directusUrl}/assets/${encodeURIComponent(id)}${qs.toString() ? `?${qs.toString()}` : ''}`;

  try {
    const upstream = await fetch(targetUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return new Response(null, { status: upstream.status });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = detectImageMimeType(buf, upstream.headers.get('content-type'));

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
};

