// src/services/promotionContextService.ts
import { query } from '@/lib/db';
import {
  getAutomaticPromotions,
  type CategoryTierPromotion,
} from '../config/promotion';
import { normalizeSku, type CustomerContext } from './promotionEngine';

export class PromotionContextService {
  /**
   * Khởi tạo CustomerContext từ dữ liệu lịch sử PostgreSQL cho một Đại lý cụ thể.
   * Tính toán các mức chiết khấu bậc thang theo danh mục mà đại lý đã đạt được trong quá khứ.
   */
  public static async getCustomerContext(
    partnerId: string | number,
    currentOrderCode?: string,
    date = new Date()
  ): Promise<CustomerContext> {
    const numericPartnerId = Number(partnerId);
    if (!numericPartnerId || isNaN(numericPartnerId)) {
      return { customerId: undefined, highestCategoryDiscounts: {} };
    }

    const activePromotions = getAutomaticPromotions(date);
    const categoryTierPromos = activePromotions.filter(
      (p): p is CategoryTierPromotion => p.type === 'category_tier'
    );

    if (categoryTierPromos.length === 0) {
      return { customerId: String(partnerId), highestCategoryDiscounts: {} };
    }

    // 1. Truy vấn lịch sử đơn hàng đã chốt (sale, done) của đại lý từ PostgreSQL
    const sql = `
      SELECT o.id, o.order_code, o.amount_total, o.status, 
             COALESCE(o.date_order, o.created_at) as date_order, o.notes,
             oi.product_id, oi.sku, oi.quantity, oi.price_unit, oi.discount_percent
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = $1 
        AND o.status IN ('sale', 'done')
        AND ($2::text IS NULL OR o.order_code != $2)
      ORDER BY COALESCE(o.date_order, o.created_at) DESC
    `;

    let rows: any[] = [];
    try {
      const res = await query(sql, [numericPartnerId, currentOrderCode || null]);
      rows = res.rows;
    } catch (err) {
      console.warn('[PromotionContextService] Lỗi truy vấn lịch sử đơn hàng từ PostgreSQL:', err);
      return { customerId: String(partnerId), highestCategoryDiscounts: {} };
    }

    // Gom nhóm đơn hàng và các dòng sản phẩm
    const ordersMap = new Map<number, {
      id: number;
      dateOrder: Date;
      notes?: string;
      lines: Array<{ sku: string; quantity: number; unitPrice: number }>;
    }>();

    for (const r of rows) {
      let order = ordersMap.get(r.id);
      if (!order) {
        order = {
          id: r.id,
          dateOrder: new Date(r.date_order),
          notes: r.notes,
          lines: [],
        };
        ordersMap.set(r.id, order);
      }
      order.lines.push({
        sku: normalizeSku(r.sku),
        quantity: Number(r.quantity || 0),
        unitPrice: Number(r.price_unit || 0),
      });
    }

    const historicalOrders = Array.from(ordersMap.values());
    const highestCategoryDiscounts: Record<string, Record<string, number>> = {};

    // 2. Tính toán chiết khấu danh mục cao nhất từng đạt được theo điều kiện của từng Promotion
    for (const promo of categoryTierPromos) {
      const { categoryId, targetSkus, tiers } = promo.condition;
      const promoId = promo.id;
      const targetSkuSet = new Set(targetSkus.map(normalizeSku));
      let maxDiscountInHistory = 0;

      for (const order of historicalOrders) {
        const orderDate = order.dateOrder;

        if (promo.startDate && orderDate < new Date(`${promo.startDate}T00:00:00`)) {
          continue;
        }
        if (promo.endDate && orderDate > new Date(`${promo.endDate}T23:59:59`)) {
          continue;
        }

        // Tính tổng tiền chi cho danh mục trong đơn hàng lịch sử này
        const categoryAmount = order.lines
          .filter((line) => targetSkuSet.has(line.sku) && line.quantity > 0)
          .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

        if (categoryAmount > 0) {
          const matchedTier = [...tiers]
            .sort((a, b) => b.minAmount - a.minAmount)
            .find((tier) => categoryAmount >= tier.minAmount);

          if (matchedTier) {
            maxDiscountInHistory = Math.max(maxDiscountInHistory, matchedTier.discountPercent);
          }
        }
      }

      if (maxDiscountInHistory > 0) {
        if (!highestCategoryDiscounts[promoId]) {
          highestCategoryDiscounts[promoId] = {};
        }
        highestCategoryDiscounts[promoId][categoryId] = maxDiscountInHistory;
      }
    }

    return {
      customerId: String(partnerId),
      highestCategoryDiscounts,
    };
  }
}