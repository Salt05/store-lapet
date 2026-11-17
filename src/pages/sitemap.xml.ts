import type { APIRoute } from 'astro';
import { getDirectusUrl } from '@/lib/catalog';

export const prerender = false;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = (
    import.meta.env.PUBLIC_SITE_URL ||
    (site ? site.toString() : '') ||
    'https://store.lapet.vn'
  ).replace(/\/+$/, '');

  const today = new Date().toISOString().split('T')[0];

  // 1. Static pages
  const urls: { loc: string; lastmod?: string; changefreq: string; priority: string }[] = [
    { loc: `${siteUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: `${siteUrl}/san-pham`, lastmod: today, changefreq: 'daily', priority: '0.9' },
    { loc: `${siteUrl}/dat-hang-nhanh`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: `${siteUrl}/lien-he`, lastmod: today, changefreq: 'monthly', priority: '0.7' },
  ];

  // 2. Dynamic pages from Directus
  const directusBase = (getDirectusUrl() || 'http://127.0.0.1:8055').replace(/\/+$/, '');
  try {
    const [resGroups, resProducts] = await Promise.all([
      fetch(`${directusBase}/items/product_groups?limit=-1&fields=id,slug`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(
        `${directusBase}/items/products?limit=-1&fields=id,slug,status&filter[status][_eq]=published`,
        {
          signal: AbortSignal.timeout(5000),
        }
      ),
    ]);

    if (resGroups.ok) {
      const groupsJson = await resGroups.json();
      const groups = Array.isArray(groupsJson?.data) ? groupsJson.data : [];
      for (const g of groups) {
        if (g?.slug) {
          urls.push({
            loc: `${siteUrl}/san-pham?category=${encodeURIComponent(g.slug)}`,
            lastmod: today,
            changefreq: 'weekly',
            priority: '0.8',
          });
        }
      }
    }

    if (resProducts.ok) {
      const productsJson = await resProducts.json();
      const products = Array.isArray(productsJson?.data) ? productsJson.data : [];
      for (const p of products) {
        if (p?.slug) {
          urls.push({
            loc: `${siteUrl}/san-pham/${encodeURIComponent(p.slug)}`,
            lastmod: today,
            changefreq: 'weekly',
            priority: '0.8',
          });
        }
      }
    }
  } catch (err) {
    console.error('[Sitemap] Lỗi truy vấn Directus khi tạo sitemap:', err);
    // Endpoint continues with static pages fallback
  }

  // 3. Render XML Sitemap according to sitemaps.org standard
  const xmlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;

  return new Response(xmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
