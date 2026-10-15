// src/services/product.service.ts

import { odooClient } from '@/lib/odoo';
import { directus } from '@/lib/directus';
import { readItems } from '@directus/sdk';

import { PromotionEngine } from './promotionEngine';
import { PromotionContextService } from './promotionContextService';

/* =========================================================
 * TYPES
 * ========================================================= */

export interface CartItemInput {
  /**
   * Odoo product.product ID.
   * Hỗ trợ đọc linh hoạt từ odoo_id, odooId hoặc id.
   */
  odoo_id?: number | string;
  odooId?: number | string;
  id?: number | string;

  qty?: number | string;
  quantity?: number | string;
}

interface OdooProduct {
  id: number;
  display_name?: string;
  name?: string;
  active?: boolean;
  sale_ok?: boolean;
  list_price?: number;
  default_code?: string;
}

interface DirectusProduct {
  odoo_id: number;
  sku: string;
  name?: string;
  image?: string;
}

/* =========================================================
 * HELPERS
 * ========================================================= */

/**
 * Ép kiểu an toàn sang số nguyên dương (> 0).
 * Trả về null nếu giá trị không hợp lệ (thay vì throw error gây crash request).
 */
function toPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

/* =========================================================
 * PRODUCT SERVICE
 * ========================================================= */

export const productService = {
  /**
   * Tính giá + khuyến mãi giỏ hàng B2B.
   */
  async calculatePricelistForCart(
    partnerId: number | string,
    items: CartItemInput[]
  ) {
    /* =======================================================
     * 0. VALIDATE PARTNER
     * ======================================================= */

    const numericPartnerId = toPositiveInteger(partnerId);
    if (!numericPartnerId) {
      throw new Error('Mã Đại lý (Partner ID) không hợp lệ.');
    }

    /* =======================================================
     * 1. EMPTY CART
     * ======================================================= */

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

    /* =======================================================
     * 2. CHUẨN HÓA & LỌC INPUT AN TOÀN
     * ======================================================= */

    const normalizedItems = items
      .map((item) => {
        // Tự động nhận diện Odoo ID qua các trường phổ biến
        const odooId =
          toPositiveInteger(item?.odoo_id) ??
          toPositiveInteger(item?.odooId) ??
          toPositiveInteger(item?.id);

        const qty =
          toPositiveInteger(item?.qty) ??
          toPositiveInteger(item?.quantity) ??
          1;

        return { odooId, qty };
      })
      .filter(
        (item): item is { odooId: number; qty: number } =>
          item.odooId !== null && item.qty > 0
      );

    if (normalizedItems.length === 0) {
      throw new Error(
        'Không tìm thấy mã sản phẩm Odoo hợp lệ trong giỏ hàng.'
      );
    }

    /* =======================================================
     * 3. GOM ODOO PRODUCT ID TRÙNG
     * ======================================================= */

    const quantityMap = new Map<number, number>();

    for (const item of normalizedItems) {
      const current = quantityMap.get(item.odooId) || 0;
      quantityMap.set(item.odooId, current + item.qty);
    }

    const mergedItems = Array.from(quantityMap.entries()).map(
      ([odooId, qty]) => ({
        odooId,
        qty,
      })
    );

    const productIds = mergedItems.map((item) => item.odooId);

    console.log('[ProductService] Processed Odoo product IDs:', productIds);

    /* =======================================================
     * 4. ĐỌC SẢN PHẨM TỪ ODOO (SOURCE OF TRUTH VỀ GIÁ & TRẠNG THÁI)
     * ======================================================= */

    let products: unknown;

    try {
      products = await odooClient.executeKw(
        'product.product',
        'read',
        [productIds],
        {
          fields: [
            'id',
            'display_name',
            'name',
            'active',
            'sale_ok',
            'list_price',
            'default_code',
          ],
        }
      );
    } catch (error) {
      console.error('Lỗi kết nối Odoo khi tính giá giỏ hàng:', error);
      throw new Error(
        'Không thể kết nối hệ thống giá Odoo. Vui lòng thử lại sau.'
      );
    }

    const productList: OdooProduct[] = Array.isArray(products)
      ? products
      : [];

    const productMap = new Map<number, OdooProduct>();

    for (const product of productList) {
      const id = Number(product?.id);
      if (Number.isInteger(id) && id > 0) {
        productMap.set(id, product);
      }
    }

    /* =======================================================
     * 5. VALIDATE SẢN PHẨM ODOO
     * ======================================================= */

    for (const item of mergedItems) {
      const product = productMap.get(item.odooId);

      if (!product) {
        throw new Error(
          `Sản phẩm Odoo ID ${item.odooId} không tồn tại hoặc đã bị xóa. Vui lòng kiểm tra lại giỏ hàng.`
        );
      }

      if (product.active === false || product.sale_ok === false) {
        throw new Error(
          `Sản phẩm "${
            product.display_name || product.name || item.odooId
          }" hiện đang ngừng kinh doanh.`
        );
      }

      const price = Number(product.list_price);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(
          `Sản phẩm "${
            product.display_name || product.name || item.odooId
          }" chưa có giá bán hợp lệ trên Odoo.`
        );
      }
    }

    /* =======================================================
     * 6. TRUY VẤN DIRECTUS (LẤY SKU & HÌNH ẢNH) VỚI FALLBACK AN TOÀN
     * ======================================================= */

    const directusMap = new Map<number, DirectusProduct>();

    try {
      const result = await directus.request<DirectusProduct[]>(
        readItems('products', {
          filter: {
            odoo_id: {
              _in: productIds,
            },
          },
          fields: ['odoo_id', 'sku'],
          limit: -1,
        })
      );

      const directusProducts = Array.isArray(result) ? result : [];

      for (const product of directusProducts) {
        const odooId = Number(product?.odoo_id);
        const sku = String(product?.sku ?? '').trim();

        if (Number.isInteger(odooId) && odooId > 0 && sku) {
          directusMap.set(odooId, {
            ...product,
            odoo_id: odooId,
            sku,
          });
        }
      }
    } catch (error) {
      console.error(
  '[ProductService] Không thể lấy SKU từ Directus:',
  error
);
      // Giữ directusMap rỗng để kích hoạt luồng fallback bên dưới
    }

    /* =======================================================
     * 7. TẠO CART CHO PROMOTION ENGINE
     * ======================================================= */

    const promotionCartItems = mergedItems.map((item) => {
      const odooProduct = productMap.get(item.odooId)!;
      const directusProduct = directusMap.get(item.odooId);

      // Fallback SKU: Ưu tiên Directus SKU -> Odoo default_code -> Odoo ID
      const sku =
        directusProduct?.sku?.trim() ||
        odooProduct.default_code?.trim() ||
        `ODOO-${item.odooId}`;

      const originalPrice = Number(odooProduct.list_price);

      return {
        sku,
        quantity: item.qty,
        originalPrice,
        unitPrice: originalPrice,
        categoryDiscountPercent: 0,
        itemDiscountPercent: 0,
        finalPrice: originalPrice,
        totalLineAmount: Math.round(originalPrice * item.qty),
      };
    });

    /* =======================================================
     * 8. LẤY CONTEXT LỊCH SỬ KHÁCH HÀNG
     * ======================================================= */

let customerContext: Awaited<ReturnType<typeof PromotionContextService.getCustomerContext>> | undefined = undefined;

    try {
      customerContext =
        await PromotionContextService.getCustomerContext(
          String(numericPartnerId)
        );
    } catch (err) {
      console.warn('Không thể tải context khuyến mãi khách hàng:', err);
    }

    console.log(
      '[Promotion DEBUG] Customer Context:',
      JSON.stringify(customerContext, null, 2)
    );

    /* =======================================================
     * 9. RUN PROMOTION ENGINE
     * ======================================================= */

    const promotionResult = PromotionEngine.calculateCart(
      promotionCartItems,
      new Date(),
      customerContext
    );

    /* =======================================================
     * 10. MAP KẾT QUẢ ĐẦU RA (RESPONSE)
     * ======================================================= */

    const processedItems = promotionResult.items.map((item) => {
      const normalizedSku = String(item.sku ?? '')
        .trim()
        .toUpperCase();

      // Khôi phục Odoo ID từ SKU
      const input = mergedItems.find((x) => {
        const directusProduct = directusMap.get(x.odooId);
        const odooProduct = productMap.get(x.odooId);

        const currentSku = (
          directusProduct?.sku ||
          odooProduct?.default_code ||
          `ODOO-${x.odooId}`
        )
          .trim()
          .toUpperCase();

        return currentSku === normalizedSku;
      });

      const odooId = input ? input.odooId : 0;
      const odooProduct = productMap.get(odooId);
      const directusProduct = directusMap.get(odooId);

      const originalPrice = Number(item.originalPrice);
      const finalPrice = Number(item.finalPrice);
      const quantity = Number(item.quantity);

      const discountAmount = Math.max(
        0,
        Math.round((originalPrice - finalPrice) * quantity)
      );

      const subtotal = Math.round(originalPrice * quantity);
      const total = Math.round(Number(item.totalLineAmount));

      return {
        id: odooId,
        odoo_id: odooId,
        name:
          odooProduct?.display_name ||
          odooProduct?.name ||
          directusProduct?.name ||
          'Sản phẩm B2B',
        sku: item.sku,
        qty: quantity,
        original_price: originalPrice,
        price: finalPrice,
        price_unit: finalPrice,
        discount_percent: Number(item.itemDiscountPercent || 0),
        discount_amount: discountAmount,
        category_discount_percent: Number(
          item.categoryDiscountPercent || 0
        ),
        subtotal,
        total,
        image: directusProduct?.image || null,
      };
    });

    /* =======================================================
     * 11. RESPONSE FIXTURE
     * ======================================================= */

    return {
      items: processedItems,
      subtotal: Number(promotionResult.subtotal || 0),
      discount_amount: Number(promotionResult.totalDiscount || 0),
      vat_amount: 0,
      total: Number(promotionResult.finalTotal || 0),
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