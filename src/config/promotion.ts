// src/config/promotion.ts

export type PromotionApplicationMode =
  | 'automatic'
  | 'manual_sales'
  | 'display_only';

export interface BasePromotion {
  id: string;
  name: string;
  active: boolean;
  stackable: boolean;
  priority: number;
  applicationMode: PromotionApplicationMode;
  description?: string;
  customerNote?: string;
  startDate?: string;
  endDate?: string;
}

export interface CategoryTierPromotion extends BasePromotion {
  type: 'category_tier';

  condition: {
    /**
     * ID logic của nhóm/campaign.
     * Chỉ dùng để nhận diện campaign và lưu lịch sử.
     *
     * KHÔNG dùng để xác định sản phẩm.
     */
    categoryId: string;

    /**
     * Tên nhóm để hiển thị.
     */
    categoryName: string;

    /**
     * DANH SÁCH SKU THỰC TẾ THAM GIA CAMPAIGN.
     *
     * Đây là nguồn xác định sản phẩm nào được tính
     * vào chương trình khuyến mãi.
     */
    targetSkus: string[];

    /**
     * Các mức chiết khấu theo tổng giá trị
     * của các SKU thuộc targetSkus.
     */
    tiers: Array<{
      minAmount: number;
      discountPercent: number;
    }>;
  };
}

export interface ProductFixedPricePromotion extends BasePromotion {
  type: 'product_fixed_price';

  condition: {
    targetSkus: string[];
    requireAllSkus: boolean;
  };

  reward: {
    customPrice: number;
  };
}

export interface ManualSalesPromotion extends BasePromotion {
  type: 'manual_sales';
  contactNote: string;
}

export type Promotion =
  | CategoryTierPromotion
  | ProductFixedPricePromotion
  | ManualSalesPromotion;

export const PROMOTIONS: Promotion[] = [];

/* ============================================================
 * HELPER FUNCTIONS
 * ============================================================ */

/**
 * Kiểm tra xem một Promotion có đang nằm trong
 * khung thời gian hiệu lực hay không.
 */
function isPromotionInDateRange(
  promotion: Promotion,
  date = new Date()
): boolean {
  const targetTime = date.getTime();

  if (promotion.startDate) {
    const start = new Date(
      `${promotion.startDate}T00:00:00`
    ).getTime();

    if (targetTime < start) {
      return false;
    }
  }

  if (promotion.endDate) {
    const end = new Date(
      `${promotion.endDate}T23:59:59`
    ).getTime();

    if (targetTime > end) {
      return false;
    }
  }

  return true;
}

/**
 * Lấy toàn bộ Promotion đang hoạt động
 * tại thời điểm kiểm tra.
 *
 * Kết quả được sắp xếp theo Priority tăng dần.
 */
export function getActivePromotions(
  date = new Date()
): Promotion[] {
  return PROMOTIONS
    .filter(
      (p) =>
        p.active &&
        isPromotionInDateRange(p, date)
    )
    .sort(
      (a, b) =>
        a.priority - b.priority
    );
}

/**
 * Lấy danh sách Promotion tự động
 * được PromotionEngine xử lý.
 */
export function getAutomaticPromotions(
  date = new Date()
): Promotion[] {
  return getActivePromotions(date).filter(
    (p) =>
      p.applicationMode === 'automatic'
  );
}


