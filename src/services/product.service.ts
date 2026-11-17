// src/services/product.service.ts
import { query } from '@/lib/db';
import { PromotionEngine } from './promotionEngine';
import { PromotionContextService } from './promotionContextService';

export interface CartItemInput {
  id?: number | string;
  odoo_id?: number | string;
  odooId?: number | string;
  sku?: string;
  qty?: number | string;
  quantity?: number | string;
}

export interface DbProduct {
  id: number;
  sku: string;
  name: string;
  slug?: string;
  description?: string;
  price: number | string;
  list_price?: number | string;
  wholesale_price: number | string;
  unit?: string;
  weight?: number;
  category?: string;
  image_url?: string;
  status: string;
  is_active: boolean;
  active?: boolean;
  sold_quantity?: number;
}

function toPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

export const productService = {
  /**
   * Lấy danh sách sản phẩm từ bảng products của PostgreSQL
   */
  async getProducts(options: {
    status?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions: string[] = ['is_active = TRUE'];
    const params: any[] = [];

    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    } else {
      conditions.push(`status = 'published'`);
    }

    if (options.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`);
    }

    let sql = `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY id ASC`;
    if (options.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
      if (options.offset) {
        params.push(options.offset);
        sql += ` OFFSET $${params.length}`;
      }
    }

    const res = await query<DbProduct>(sql, params);
    return res.rows;
  },

  /**
   * Lấy chi tiết sản phẩm theo ID
   */
  async getProductById(id: number): Promise<DbProduct | null> {
    const res = await query<DbProduct>('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Lấy chi tiết sản phẩm theo SKU
   */
  async getProductBySku(sku: string): Promise<DbProduct | null> {
    const res = await query<DbProduct>('SELECT * FROM products WHERE UPPER(sku) = UPPER($1) LIMIT 1', [sku.trim()]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Lấy chi tiết sản phẩm theo Slug
   */
  async getProductBySlug(slug: string): Promise<DbProduct | null> {
    const res = await query<DbProduct>('SELECT * FROM products WHERE slug = $1 LIMIT 1', [slug.trim()]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Tính giá + khuyến mãi giỏ hàng B2B thực thi trực tiếp trên PostgreSQL
   */
  async calculatePricelistForCart(
    partnerId: number | string,
    items: CartItemInput[]
  ) {
    const numericPartnerId = toPositiveInteger(partnerId);
    if (!numericPartnerId) {
      throw new Error('Mã Đại lý (Partner ID) không hợp lệ.');
    }

    if (!Array.isArray(items) || items.length === 0) {
      return {
        items: [],
        subtotal: 0,
        discount_amount: 0,
        vat_amount: 0,
        total: 0,
        appliedPromotions: {
          fixedPricePromos: [],
          categoryTierPromos: [],
        },
        proposedPromotions: {
          categoryTierPromos: [],
        },
      };
    }

    // 1. Chuẩn hóa & gom các item
    const parsedItems = items.map((item) => {
      const rawId = item.id ?? item.odoo_id ?? item.odooId;
      const numId = toPositiveInteger(rawId);
      const sku = item.sku ? String(item.sku).trim().toUpperCase() : '';
      const rawQty = item.quantity ?? item.qty ?? 1;
      const numQty = typeof rawQty === 'number' ? Math.round(rawQty) : parseInt(String(rawQty), 10) || 1;
      return { id: numId, sku, qty: Math.max(0, numQty) };
    }).filter((item) => item.qty > 0 && (item.id !== null || item.sku.length > 0));

    if (parsedItems.length === 0) {
      return {
        items: [],
        subtotal: 0,
        discount_amount: 0,
        vat_amount: 0,
        total: 0,
        appliedPromotions: { fixedPricePromos: [], categoryTierPromos: [] },
        proposedPromotions: { categoryTierPromos: [] },
      };
    }

    // Gom số lượng theo SKU (ưu tiên) hoặc ID
    const mergedMap = new Map<string, { id?: number; sku?: string; qty: number }>();
    for (const item of parsedItems) {
      const key = item.sku ? `SKU_${item.sku}` : (item.id ? `ID_${item.id}` : '');
      if (!key) continue;
      const existing = mergedMap.get(key);
      if (existing) {
        existing.qty += item.qty;
      } else {
        mergedMap.set(key, { ...item, id: item.id || undefined, sku: item.sku || undefined });
      }
    }
    const mergedList = Array.from(mergedMap.values());

    // 2. Query sản phẩm từ PostgreSQL products table
    const productIds = mergedList.map((m) => m.id).filter((id): id is number => typeof id === 'number');
    const productSkus = mergedList.map((m) => m.sku).filter((sku): sku is string => typeof sku === 'string' && sku.length > 0);

    const conditions: string[] = [];
    const params: any[] = [];

    if (productIds.length > 0) {
      params.push(productIds);
      conditions.push(`id = ANY($${params.length})`);
    }
    if (productSkus.length > 0) {
      params.push(productSkus);
      conditions.push(`UPPER(sku) = ANY($${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';
    const dbRes = await query<DbProduct>(`SELECT * FROM products ${whereClause}`, params);
    const dbProducts = dbRes.rows;

    const productById = new Map<number, DbProduct>();
    const productBySku = new Map<string, DbProduct>();
    for (const p of dbProducts) {
      productById.set(Number(p.id), p);
      if (p.sku) {
        productBySku.set(p.sku.trim().toUpperCase(), p);
      }
    }

    // 3. Chuẩn bị promotionCartItems cho PromotionEngine (ưu tiên tìm theo SKU để tránh lệch ID với Directus)
    const promotionCartItems = mergedList.map((item) => {
      const product = (item.sku && productBySku.get(item.sku)) || (item.id && productById.get(item.id));
      if (!product) {
        throw new Error(`Sản phẩm ${item.sku || item.id} không tồn tại hoặc đã ngừng bán.`);
      }
      const wholesalePrice = Number(product.wholesale_price);
      const listPrice = Number(product.list_price || product.price || 0);
      const originalPrice = listPrice > 0 ? listPrice : wholesalePrice;
      const baseUnitPrice = wholesalePrice > 0 ? wholesalePrice : originalPrice;

      return {
        sku: product.sku.trim().toUpperCase(),
        quantity: item.qty,
        originalPrice,
        unitPrice: baseUnitPrice,
        categoryDiscountPercent: 0,
        itemDiscountPercent: 0,
        finalPrice: baseUnitPrice,
        totalLineAmount: Math.round(baseUnitPrice * item.qty),
      };
    });

    // 4. Lấy Customer Context từ PostgreSQL qua PromotionContextService
    let customerContext: any = undefined;
    try {
      customerContext = await PromotionContextService.getCustomerContext(String(numericPartnerId));
    } catch (ctxErr) {
      console.warn('[ProductService] Không thể tải customer context:', ctxErr);
    }

    // 5. Chạy PromotionEngine
    const promotionResult = await PromotionEngine.calculateCartDynamic(
      promotionCartItems,
      new Date(),
      customerContext
    );

    // 6. Map kết quả đầu ra
    const processedItems = promotionResult.items.map((item) => {
      const normSku = item.sku.trim().toUpperCase();
      const product = productBySku.get(normSku);
      const originalPrice = Number(item.originalPrice);
      const finalPrice = Number(item.finalPrice);
      const quantity = Number(item.quantity);
      const discountAmount = Math.max(0, Math.round((originalPrice - finalPrice) * quantity));
      const subtotal = Math.round(originalPrice * quantity);
      const total = Math.round(Number(item.totalLineAmount));

      return {
        id: product?.id || 0,
        odoo_id: product?.id || 0,
        name: product?.name || 'Sản phẩm B2B',
        sku: item.sku,
        qty: quantity,
        quantity,
        original_price: originalPrice,
        price: finalPrice,
        price_unit: finalPrice,
        unit_price: finalPrice,
        discount_percent: Number(item.itemDiscountPercent || 0),
        discount_amount: discountAmount,
        category_discount_percent: Number(item.categoryDiscountPercent || 0),
        subtotal,
        total,
        image: product?.image_url || null,
        image_url: product?.image_url || null,
        unit: product?.unit || 'Cái',
      };
    });

    const subtotal = Number(promotionResult.subtotal || 0);
    const discount_amount = Number(promotionResult.totalDiscount || 0);
    const total = Number(promotionResult.finalTotal || 0);

    return {
      items: processedItems,
      subtotal,
      discount_amount,
      vat_amount: 0,
      total,
      appliedPromotions: promotionResult.appliedPromotions || {
        fixedPricePromos: [],
        categoryTierPromos: [],
      },
      proposedPromotions: promotionResult.proposedPromotions || {
        categoryTierPromos: [],
      },
    };
  },
};