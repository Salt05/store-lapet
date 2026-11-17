// src/services/promotionEngine.ts

import {
  getAutomaticPromotions,
  type ProductFixedPricePromotion,
  type Promotion,
} from '../config/promotion';
import { configService } from './config.service';

/**
 * Helper chuẩn hóa SKU đồng nhất: loại bỏ khoảng trắng thừa và ép về chữ hoa.
 */
export function normalizeSku(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export interface CartItem {
  /**
   * SKU do Directus cung cấp.
   * Chỉ dùng để đối chiếu campaign trong Promotion Engine.
   */
  sku: string;

  quantity: number;

  /**
   * Giá gốc / giá đại lý lấy từ Odoo (Single Source of Truth).
   */
  originalPrice: number;

  /**
   * Giá unit sau khi áp dụng các chương trình trợ giá SKU (product_fixed_price).
   */
  unitPrice: number;

  /**
   * Phần trăm chiết khấu Category Tier áp dụng riêng cho dòng sản phẩm.
   */
  categoryDiscountPercent: number;

  /**
   * Phần trăm chiết khấu tổng cộng áp dụng lên item so với giá gốc.
   */
  itemDiscountPercent: number;

  /**
   * Giá đơn vị cuối cùng sau toàn bộ khuyến mãi (Đã làm tròn VNĐ).
   */
  finalPrice: number;

  /**
   * Thành tiền cuối cùng của dòng sản phẩm (finalPrice * quantity).
   */
  totalLineAmount: number;
}

export interface CustomerContext {
  customerId?: string;

  /**
   * Mức chiết khấu cao nhất đại lý đã đạt được trong thời gian chạy 
   * của TỪNG PROMOTION (không bao gồm giỏ hàng/đơn hàng hiện tại).
   *
   * Key cấp 1: promotionId (ví dụ: 'xuong-gam-tier-2026')
   * Key cấp 2: categoryId (ví dụ: 'xuong-gam')
   * Value: discountPercent cao nhất đã đạt được trong quá khứ (ví dụ: 14)
   */
  highestCategoryDiscounts?: Record<string, Record<string, number>>;
}

export interface PromotionEngineResult {
  items: CartItem[];

  /**
   * Tổng tiền giỏ hàng theo giá đại lý ban đầu từ Odoo.
   */
  subtotal: number;

  /**
   * Tổng số tiền được giảm bởi tất cả các chương trình khuyến mãi.
   */
  totalDiscount: number;

  /**
   * Tổng số tiền khách hàng thực tế phải thanh toán.
   */
  finalTotal: number;

  appliedPromotions: {
    fixedPricePromos: string[];

    categoryTierPromos: Array<{
      promoId: string;
      categoryId: string;
      appliedPercent: number;
    }>;
  };

  /**
   * Trả về để tương thích với order.service.ts
   */
  proposedPromotions: {
    categoryTierPromos: Array<{
      promoId: string;
      categoryId: string;
      appliedPercent: number;
    }>;
  };
}

export class PromotionEngine {
  public static async calculateCartDynamic(
    cartItems: CartItem[],
    date = new Date(),
    customerContext?: CustomerContext
  ): Promise<PromotionEngineResult> {
    const activePromos = await configService.getActivePromotions(date);
    return this.calculateCart(cartItems, date, customerContext, activePromos);
  }

  /**
   * Tính toán toàn bộ khuyến mãi cho giỏ hàng.
   * Khuyến mãi tự động được duyệt theo thứ tự Priority tăng dần (Priority nhỏ chạy trước).
   */
  public static calculateCart(
    cartItems: CartItem[],
    date = new Date(),
    customerContext?: CustomerContext,
    overridePromotions?: Promotion[]
  ): PromotionEngineResult {
    // 1. Khởi tạo danh sách item ban đầu & chuẩn hóa SKU
    let processedItems: CartItem[] = cartItems.map((item) => ({
      ...item,
      sku: normalizeSku(item.sku),
      unitPrice: item.originalPrice,
      categoryDiscountPercent: 0,
      itemDiscountPercent: 0,
      finalPrice: item.originalPrice,
      totalLineAmount: Math.round(item.originalPrice * item.quantity),
    }));

    // 2. Lấy danh sách khuyến mãi tự động (đã được sắp xếp sẵn theo priority)
    const automaticPromotions = overridePromotions
      ? overridePromotions.filter((p) => p.applicationMode === 'automatic').sort((a, b) => a.priority - b.priority)
      : getAutomaticPromotions(date);

    const appliedFixedPromos: string[] = [];
    const appliedTierPromos: Array<{
      promoId: string;
      categoryId: string;
      appliedPercent: number;
    }> = [];

    // Tổng tiền ban đầu theo giá Odoo
    const subtotal = cartItems.reduce(
      (sum, item) => sum + Math.round(item.originalPrice * item.quantity),
      0
    );

    /* =========================================================
     * CHẠY TOÀN BỘ PROMOTION THEO THỨ TỰ PRIORITY
     * ========================================================= */

    for (const promo of automaticPromotions) {
      switch (promo.type) {
        /* =====================================================
         * 1. PRODUCT FIXED PRICE (Trợ giá / Giá đặc biệt theo SKU)
         * ===================================================== */
        case 'product_fixed_price': {
          if (!this.isProductFixedPriceEligible(promo, processedItems)) {
            break;
          }

          appliedFixedPromos.push(promo.id);

          const targetSkuSet = new Set(
            promo.condition.targetSkus.map(normalizeSku)
          );

          // Cập nhật unitPrice cho các SKU thuộc danh sách được trợ giá
          processedItems = processedItems.map((item) => {
            if (!targetSkuSet.has(normalizeSku(item.sku))) {
              return item;
            }

            const unitPrice = promo.reward.customPrice;
            const finalPrice = unitPrice;
            const totalLineAmount = Math.round(finalPrice * item.quantity);

            // Tính % discount thực tế so với giá gốc
            const itemDiscountPercent =
              item.originalPrice > 0
                ? Math.round(((item.originalPrice - finalPrice) / item.originalPrice) * 100)
                : 0;

            return {
              ...item,
              unitPrice,
              itemDiscountPercent,
              finalPrice,
              totalLineAmount,
            };
          });

          break;
        }

        /* =====================================================
         * 2. CATEGORY TIER (Chiết khấu bậc thang theo targetSkus)
         * ===================================================== */
        case 'category_tier': {
          const {
            categoryId,
            targetSkus,
            tiers,
          } = promo.condition;

          const targetSkuSet = new Set(targetSkus.map(normalizeSku));

          const categoryTotalAmount = processedItems
            .filter((item) => targetSkuSet.has(normalizeSku(item.sku)))
            .reduce(
              (sum, item) => sum + item.unitPrice * item.quantity,
              0
            );

          // a. Chiết khấu đạt được dựa trên giá trị giỏ hàng hiện tại
          let calculatedPercent = 0;
          if (categoryTotalAmount > 0) {
            const matchedTier = [...tiers]
              .sort((a, b) => b.minAmount - a.minAmount)
              .find((tier) => categoryTotalAmount >= tier.minAmount);

            if (matchedTier) {
              calculatedPercent = matchedTier.discountPercent;
            }
          }

          // b. Chiết khấu cao nhất đã đạt được trong lịch sử
          const historicalHighestPercent =
            customerContext?.highestCategoryDiscounts?.[promo.id]?.[categoryId] ?? 0;

          console.log('[Promotion DEBUG]', {
            promoId: promo.id,
            categoryId,
            categoryTotalAmount,
            calculatedPercent,
            historicalHighestPercent,
          });

          // c. Lấy mức chiết khấu cao nhất giữa giỏ hiện tại và lịch sử
          const discountPercent = Math.max(calculatedPercent, historicalHighestPercent);

          if (discountPercent <= 0) {
            break;
          }

          appliedTierPromos.push({
            promoId: promo.id,
            categoryId,
            appliedPercent: discountPercent,
          });

          // d. Áp dụng % chiết khấu lên tất cả sản phẩm thuộc targetSkus
          processedItems = processedItems.map((item) => {
            if (!targetSkuSet.has(normalizeSku(item.sku))) {
              return item;
            }

            const finalPrice = Math.round(item.unitPrice * (1 - discountPercent / 100));
            const totalLineAmount = Math.round(finalPrice * item.quantity);

            const itemDiscountPercent =
              item.originalPrice > 0
                ? Math.round(((item.originalPrice - finalPrice) / item.originalPrice) * 100)
                : 0;

            return {
              ...item,
              categoryDiscountPercent: discountPercent,
              itemDiscountPercent,
              finalPrice,
              totalLineAmount,
            };
          });

          break;
        }
      }
    }

    /* =========================================================
     * TỔNG HỢP KẾT QUẢ TÍNH GIÁ GIỎ HÀNG
     * ========================================================= */

    const finalTotal = processedItems.reduce(
      (sum, item) => sum + item.totalLineAmount,
      0
    );

    const totalDiscount = subtotal - finalTotal;

    return {
      items: processedItems,
      subtotal,
      totalDiscount,
      finalTotal,
      appliedPromotions: {
        fixedPricePromos: appliedFixedPromos,
        categoryTierPromos: appliedTierPromos,
      },
      proposedPromotions: {
        categoryTierPromos: appliedTierPromos,
      },
    };
  }

  /**
   * Kiểm tra điều kiện Product Fixed Price.
   */
  private static isProductFixedPriceEligible(
    promo: ProductFixedPricePromotion,
    items: CartItem[]
  ): boolean {
    const { targetSkus, requireAllSkus } = promo.condition;

    const normalizedTargetSkus = targetSkus.map(normalizeSku);
    const cartSkus = new Set(
      items
        .filter((item) => item.quantity > 0)
        .map((item) => normalizeSku(item.sku))
    );

    if (requireAllSkus) {
      return normalizedTargetSkus.every((sku) => cartSkus.has(sku));
    }

    return normalizedTargetSkus.some((sku) => cartSkus.has(sku));
  }
}