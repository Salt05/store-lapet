// src/services/promotionContextService.ts

import { odooClient } from '@/lib/odoo';
import { directus } from '@/lib/directus'; // Sửa đổi: Import đúng tên 'directus' đã được export
import { readItems } from '@directus/sdk'; // Thêm helper hàm từ Directus SDK
import {
  getAutomaticPromotions,
  type CategoryTierPromotion,
} from '../config/promotion';
import { normalizeSku, type CustomerContext } from './promotionEngine';

export interface OdooSaleOrderLine {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface AppliedHistoricalPromotion {
  promotionId: string;
  categoryId: string;
  discountPercent: number;
}

export interface OdooSaleOrder {
  id: string;
  name: string;
  partnerId: string;
  state: 'sale' | 'done';
  dateOrder: string;
  lines: OdooSaleOrderLine[];
  appliedPromotions?: AppliedHistoricalPromotion[];
}

function parseOrderMetadata(
  metadataRaw: unknown
): AppliedHistoricalPromotion[] {
  if (typeof metadataRaw !== 'string' || !metadataRaw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(metadataRaw);
    const promotions = parsed?.promotions;

    if (!Array.isArray(promotions)) {
      return [];
    }

    return promotions
      .map((promo: any) => ({
        promotionId: String(promo?.promotionId ?? ''),
        categoryId: String(promo?.categoryId ?? ''),
        discountPercent: Number(promo?.discountPercent ?? 0),
      }))
      .filter(
        (promo) =>
          promo.promotionId !== '' &&
          promo.categoryId !== '' &&
          Number.isFinite(promo.discountPercent) &&
          promo.discountPercent > 0
      );
  } catch {
    return [];
  }
}

function formatOdooDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export class PromotionContextService {
  /**
   * Khởi tạo CustomerContext từ dữ liệu lịch sử Odoo cho một Đại lý cụ thể.
   */
  public static async getCustomerContext(
    partnerId: string,
    currentOrderName?: string,
    date = new Date()
  ): Promise<CustomerContext> {
    if (!partnerId) {
      return { customerId: undefined, highestCategoryDiscounts: {} };
    }

    const activePromotions = getAutomaticPromotions(date);
    const categoryTierPromos = activePromotions.filter(
      (p): p is CategoryTierPromotion => p.type === 'category_tier'
    );

    if (categoryTierPromos.length === 0) {
      return { customerId: partnerId, highestCategoryDiscounts: {} };
    }

    /* =========================================================================
     * 1. XÁC ĐỊNH KHUNG THỜI GIAN BAO PHỦ TOÀN BỘ CÁC PROMOTION
     * ========================================================================= */
    const startTimes = categoryTierPromos
      .filter((p) => p.startDate)
      .map((p) => new Date(`${p.startDate}T00:00:00`).getTime());

    const endTimes = categoryTierPromos
      .filter((p) => p.endDate)
      .map((p) => new Date(`${p.endDate}T23:59:59`).getTime());

    const startDate =
      startTimes.length > 0
        ? new Date(Math.min(...startTimes))
        : new Date(0);
    const endDate =
      endTimes.length > 0
        ? new Date(Math.max(...endTimes))
        : new Date('2099-12-31T23:59:59');

    /* =========================================================================
     * 2. CHỈ QUERY ODOO 1 LẦN DUY NHẤT & LOẠI TRỪ ĐƠN ĐANG CHECKOUT
     * ========================================================================= */
    const rawOrders = await this.fetchConfirmedOrdersFromOdoo(
      partnerId,
      startDate,
      endDate
    );

    const historicalOrders = currentOrderName
      ? rawOrders.filter((order) => order.name !== currentOrderName)
      : rawOrders;

    const allProductIds = Array.from(
      new Set(
        historicalOrders.flatMap((order) => order.lines.map((l) => l.productId))
      )
    );

    const directusSkuByOdooId = await this.getDirectusSkuMap(allProductIds);

    const highestCategoryDiscounts: Record<
      string,
      Record<string, number>
    > = {};

    /* =========================================================================
     * 3. PHÂN TÍCH LỊCH SỬ DỰA TRÊN METADATA HOẶC TRA CỨU DIRECTUS SKU
     * ========================================================================= */
    for (const promo of categoryTierPromos) {
      const { categoryId, targetSkus, tiers } = promo.condition;
      const promoId = promo.id;
      const targetSkuSet = new Set(targetSkus.map(normalizeSku));
      let maxDiscountInHistory = 0;

      for (const order of historicalOrders) {
        const orderDate = new Date(order.dateOrder);

        if (
          promo.startDate &&
          orderDate < new Date(`${promo.startDate}T00:00:00`)
        ) {
          continue;
        }
        if (
          promo.endDate &&
          orderDate > new Date(`${promo.endDate}T23:59:59`)
        ) {
          continue;
        }

        const historicalPromotions = order.appliedPromotions || [];

        if (historicalPromotions.length > 0) {
          const matchedHistoricalPromotion = historicalPromotions.find(
            (applied) =>
              applied.promotionId === promoId &&
              applied.categoryId === categoryId
          );

          if (matchedHistoricalPromotion) {
            maxDiscountInHistory = Math.max(
              maxDiscountInHistory,
              Number(matchedHistoricalPromotion.discountPercent)
            );
          }
        } else {
          const categoryAmount = order.lines
            .filter((line) => {
              const sku = directusSkuByOdooId.get(line.productId);
              return sku && targetSkuSet.has(normalizeSku(sku)) && line.quantity > 0;
            })
            .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

          if (categoryAmount > 0) {
            const matchedTier = [...tiers]
              .sort((a, b) => b.minAmount - a.minAmount)
              .find((tier) => categoryAmount >= tier.minAmount);

            if (matchedTier) {
              maxDiscountInHistory = Math.max(
                maxDiscountInHistory,
                matchedTier.discountPercent
              );
            }
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
      customerId: partnerId,
      highestCategoryDiscounts,
    };
  }

  private static async fetchConfirmedOrdersFromOdoo(
    partnerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<OdooSaleOrder[]> {
    const numericPartnerId = Number(partnerId);

    if (!Number.isInteger(numericPartnerId) || numericPartnerId <= 0) {
      return [];
    }

    const orders = await odooClient.executeKw(
      'sale.order',
      'search_read',
      [
        [
          ['partner_id', '=', numericPartnerId],
          ['state', 'in', ['sale', 'done']],
          ['date_order', '>=', formatOdooDateTime(startDate)],
          ['date_order', '<=', formatOdooDateTime(endDate)],
        ],
      ],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'state',
          'date_order',
          'order_line',
        ],
        order: 'date_order desc',
      }
    );

    if (!Array.isArray(orders) || orders.length === 0) {
      return [];
    }

    const lineIds: number[] = [];
    for (const order of orders) {
      if (Array.isArray(order.order_line)) {
        for (const id of order.order_line) {
          lineIds.push(Number(id));
        }
      }
    }

    if (lineIds.length === 0) {
      return orders.map((order: any) => ({
        id: String(order.id),
        name: String(order.name || ''),
        partnerId: String(partnerId),
        state: order.state,
        dateOrder: String(order.date_order || ''),
        lines: [],
        appliedPromotions: [],
      }));
    }

    const rawLines = await odooClient.executeKw(
      'sale.order.line',
      'read',
      [lineIds],
      {
        fields: [
          'id',
          'order_id',
          'product_id',
          'product_uom_qty',
          'price_unit',
        ],
      }
    );

    const lineList = Array.isArray(rawLines) ? rawLines : [];
    const linesByOrderId = new Map<number, OdooSaleOrderLine[]>();

    for (const line of lineList) {
      const orderId = Array.isArray(line.order_id)
        ? Number(line.order_id[0])
        : Number(line.order_id);

      const productId = Array.isArray(line.product_id)
        ? Number(line.product_id[0])
        : Number(line.product_id);

      const lineItem: OdooSaleOrderLine = {
        productId,
        quantity: Number(line.product_uom_qty || 0),
        unitPrice: Number(line.price_unit || 0),
      };

      if (!linesByOrderId.has(orderId)) {
        linesByOrderId.set(orderId, []);
      }

      linesByOrderId.get(orderId)!.push(lineItem);
    }

    return orders.map((order: any) => ({
      id: String(order.id),
      name: String(order.name || ''),
      partnerId: String(partnerId),
      state: order.state,
      dateOrder: String(order.date_order || ''),
      lines: linesByOrderId.get(Number(order.id)) || [],
      appliedPromotions: [],
    }));
  }

  /**
   * Tra cứu Directus để tạo Map<odoo_id, SKU> chuẩn theo Directus SDK v11+
   */
  private static async getDirectusSkuMap(
    odooIds: number[]
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (odooIds.length === 0) return map;

    try {
      const items = await directus.request<any[]>(
        readItems('products', {
          filter: {
            odoo_id: { _in: odooIds },
          },
          fields: ['odoo_id', 'sku'],
          limit: -1,
        })
      );

      for (const item of items || []) {
        if (item?.odoo_id && item?.sku) {
          map.set(Number(item.odoo_id), String(item.sku).trim());
        }
      }
    } catch (error) {
      console.error('Lỗi khi tra cứu SKU từ Directus cho lịch sử đơn hàng:', error);
    }

    return map;
  }
}