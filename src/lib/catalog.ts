// src/lib/catalog.ts
// ============================================================
// Lớp truy vấn Danh mục / Sản phẩm từ Directus (Server-side only)
// - Dùng chung cho Header (Mega Menu), Trang chủ (Showcase Hero),
//   trang /san-pham và trang chi tiết /san-pham/[slug].
// - Có cache in-memory TTL ngắn cho dữ liệu ít thay đổi (nhóm sản phẩm)
//   để tránh Header gọi Directus ở MỌI request.
// ============================================================

import { query } from '@/lib/db';

export const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg';

const FETCH_TIMEOUT_MS = 5000;
const GROUPS_CACHE_TTL_MS = 60_000;

/* =========================================================
 * TYPES
 * ========================================================= */
export interface ProductGroup {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  /** Ảnh đại diện nhóm = ảnh của sản phẩm bán chạy nhất trong nhóm */
  thumbnail: string | null;
}

export interface CatalogProduct {
  id: number;
  odoo_id: number | null;
  sku: string;
  name: string;
  slug: string;
  price: number;
  wholesale_price: number;
  sold_quantity: number;
  weight: string | null;
  specification: string | null;
  ingredients: string | null;
  description: string | null;
  target: string | null;
  preservation: string | null;
  nutritional_info: string | null;
  imageIds: string[];
  groupIds: number[];
}

/* =========================================================
 * HELPERS
 * ========================================================= */
export function getDirectusUrl(): string {
  const url =
    import.meta.env.DIRECTUS_URL ||
    (typeof process !== 'undefined' ? process.env.DIRECTUS_URL : '') ||
    import.meta.env.PUBLIC_DIRECTUS_URL ||
    '';
  return String(url).replace(/\/+$/, '');
}

/** URL ảnh công khai (trình duyệt tải trực tiếp) */
export function getPublicDirectusUrl(): string {
  const url =
    import.meta.env.PUBLIC_DIRECTUS_URL ||
    (typeof process !== 'undefined' ? process.env.PUBLIC_DIRECTUS_URL : '') ||
    getDirectusUrl();
  return String(url).replace(/\/+$/, '');
}

export interface AssetOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'inside' | 'outside';
  format?: 'webp' | 'jpg' | 'png' | 'auto';
}

export function assetUrl(fileId: string | null | undefined, opts: AssetOptions = {}): string {
  if (!fileId) return PLACEHOLDER_IMAGE;
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  if (opts.quality) params.set('quality', String(opts.quality));
  if (opts.fit) params.set('fit', opts.fit);
  if (opts.format) params.set('format', opts.format);
  const qs = params.toString();
  return `${getPublicDirectusUrl()}/assets/${fileId}${qs ? `?${qs}` : ''}`;
}

async function directusGet<T = any>(path: string): Promise<T | null> {
  const base = getDirectusUrl();
  if (!base) {
    console.error('[Catalog] DIRECTUS_URL chưa được cấu hình');
    return null;
  }
  try {
    const res = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[Catalog] Directus ${res.status} - ${path}`);
      return null;
    }
    const json = await res.json();
    return (json?.data ?? null) as T;
  } catch (err: any) {
    console.error(`[Catalog] Lỗi kết nối Directus (${path}):`, err?.message || err);
    return null;
  }
}

function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || val === 'null') return null;
  const n = parseInt(String(val), 10);
  return Number.isNaN(n) ? null : n;
}

function extractFileId(img: any): string | null {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (typeof img.directus_files_id === 'string') return img.directus_files_id;
  if (img.directus_files_id?.id) return img.directus_files_id.id;
  return null;
}

function extractGroupId(g: any): number | null {
  if (g === null || g === undefined) return null;
  if (typeof g === 'number') return g;
  const raw = g.product_groups_id;
  if (raw && typeof raw === 'object') return toNumberOrNull(raw.id);
  return toNumberOrNull(raw);
}

const LIST_FIELDS = [
  'id', 'odoo_id', 'sku', 'name', 'slug', 'price', 'wholesale_price',
  'sold_quantity', 'weight', 'specification',
  'images.directus_files_id', 'product_groups.product_groups_id',
].join(',');

const DETAIL_FIELDS = [
  LIST_FIELDS, 'ingredients', 'description', 'target', 'preservation', 'nutritional_info',
].join(',');

function normalizeProduct(raw: any): CatalogProduct {
  return {
    id: Number(raw.id),
    odoo_id: toNumberOrNull(raw.odoo_id),
    sku: raw.sku || '',
    name: raw.name || 'Sản phẩm LA PET',
    slug: raw.slug || String(raw.id),
    price: Number(raw.price) || 0,
    wholesale_price: Number(raw.wholesale_price) || 0,
    sold_quantity: Number(raw.sold_quantity) || 0,
    weight: raw.weight || null,
    specification: raw.specification || null,
    ingredients: raw.ingredients || null,
    description: raw.description || null,
    target: raw.target || null,
    preservation: raw.preservation || null,
    nutritional_info: raw.nutritional_info || null,
    imageIds: Array.isArray(raw.images)
      ? (raw.images.map(extractFileId).filter(Boolean) as string[])
      : [],
    groupIds: Array.isArray(raw.product_groups)
      ? (raw.product_groups.map(extractGroupId).filter((x: number | null) => x !== null) as number[])
      : [],
  };
}

/** Giá hiển thị theo vai trò (đại lý ưu tiên giá sỉ nếu có) */

export function formatVnd(value: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0đ';
  return value.toLocaleString('vi-VN') + 'đ';
}

/* =========================================================
 * QUERIES
 * ========================================================= */
let groupsCache: { at: number; data: ProductGroup[] } | null = null;

/**
 * Danh sách nhóm sản phẩm (kèm số lượng & ảnh đại diện), cache 60s.
 * Chỉ trả về nhóm có ít nhất 1 sản phẩm đang published.
 */
export async function getProductGroups(options: { includeEmpty?: boolean } = {}): Promise<ProductGroup[]> {
  const now = Date.now();
  let all: ProductGroup[];

  if (groupsCache && now - groupsCache.at < GROUPS_CACHE_TTL_MS) {
    all = groupsCache.data;
  } else {
    const [groups, products] = await Promise.all([
      directusGet<any[]>('/items/product_groups?limit=-1&fields=id,name,slug,description&sort=id'),
      directusGet<any[]>(
        '/items/products?limit=-1&filter[status][_eq]=published&sort=-sold_quantity' +
          '&fields=id,sold_quantity,images.directus_files_id,product_groups.product_groups_id'
      ),
    ]);

    if (!groups) {
      // Lỗi kết nối: dùng cache cũ nếu có, không cache kết quả rỗng
      return groupsCache?.data.filter((g) => options.includeEmpty || g.productCount > 0) ?? [];
    }

    const normalized = (products || []).map(normalizeProduct);
    all = groups.map((g: any) => {
      const id = Number(g.id);
      const members = normalized.filter((p) => p.groupIds.includes(id));
      const cover = members.find((p) => p.imageIds.length > 0);
      return {
        id,
        name: g.name || `Nhóm ${id}`,
        slug: g.slug || `group-${id}`,
        description: g.description || null,
        productCount: members.length,
        thumbnail: cover ? assetUrl(cover.imageIds[0], { width: 200, height: 200, fit: 'contain', quality: 80, format: 'webp' }) : null,
      };
    });
    groupsCache = { at: now, data: all };
  }

  return options.includeEmpty ? all : all.filter((g) => g.productCount > 0);
}

/**
 * Đồng bộ giá bán lẻ, giá sỉ và trạng thái tồn kho thời gian thực từ PostgreSQL theo SKU (Single Source of Truth)
 */
export async function enrichWithPostgresData<T extends { sku: string; price?: number; wholesale_price?: number }>(
  items: T[]
): Promise<T[]> {
  if (!items || items.length === 0) return items;
  const skus = items.map((i) => i.sku).filter(Boolean);
  if (skus.length === 0) return items;

  try {
    const res = await query(
      `SELECT p.sku, p.price, p.wholesale_price, p.status, p.is_active,
              COALESCE(inv.available, (inv.on_hand - inv.reserved), 0) as available_stock
       FROM products p
       LEFT JOIN inventory_items inv ON UPPER(TRIM(p.sku)) = UPPER(TRIM(inv.sku))
       WHERE UPPER(TRIM(p.sku)) = ANY($1)`,
      [skus.map((s) => s.trim().toUpperCase())]
    );

    const pgMap = new Map<string, any>();
    for (const row of res.rows) {
      if (row.sku) pgMap.set(row.sku.trim().toUpperCase(), row);
    }

    for (const item of items) {
      if (item.sku) {
        const pg = pgMap.get(item.sku.trim().toUpperCase());
        if (pg) {
          if (pg.price !== null && pg.price !== undefined) item.price = Number(pg.price);
          if (pg.wholesale_price !== null && pg.wholesale_price !== undefined) item.wholesale_price = Number(pg.wholesale_price);
          (item as any).available_stock = Number(pg.available_stock || 0);
          if (pg.is_active === false || pg.status === 'archived') {
            (item as any).is_active = false;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[Catalog] Lỗi đồng bộ dữ liệu giá từ PostgreSQL:', err?.message || err);
  }
  return items;
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;
  const data = await directusGet<any[]>(
    `/items/products?limit=1&filter[slug][_eq]=${encodeURIComponent(slug)}&filter[status][_eq]=published&fields=${DETAIL_FIELDS}`
  );
  if (!data || data.length === 0) return null;
  const product = normalizeProduct(data[0]);
  await enrichWithPostgresData([product]);
  return product;
}

/** Sản phẩm cho dải Showcase Hero — mặc định top bán chạy */
export async function getShowcaseProducts(limit = 12): Promise<CatalogProduct[]> {
  const data = await directusGet<any[]>(
    `/items/products?limit=${limit}&filter[status][_eq]=published&sort=-sold_quantity&fields=${LIST_FIELDS}`
  );
  const products = (data || []).map(normalizeProduct);
  return await enrichWithPostgresData(products);
}

/** Sản phẩm liên quan: cùng nhóm, loại trừ sản phẩm hiện tại */
export async function getRelatedProducts(product: CatalogProduct, limit = 4): Promise<CatalogProduct[]> {
  if (product.groupIds.length === 0) return [];
  const groupFilter = encodeURIComponent(product.groupIds.join(','));
  const data = await directusGet<any[]>(
    `/items/products?limit=${limit}&filter[status][_eq]=published&filter[id][_neq]=${product.id}` +
      `&filter[product_groups][product_groups_id][_in]=${groupFilter}&sort=-sold_quantity&fields=${LIST_FIELDS}`
  );
  const products = (data || []).map(normalizeProduct);
  return await enrichWithPostgresData(products);
}
