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

export const PROMOTIONS: Promotion[] = [
  /* ==========================================================
   * 1. CHIẾT KHẤU ĐẶC BIỆT ĐƠN HÀNG XƯƠNG GẶM (TỰ ĐỘNG)
   * ========================================================== */
  {
    id: 'xuong-gam-tier-2026',
    name: 'Chiết khấu đặc biệt đơn hàng Xương Gặm',
    type: 'category_tier',

    active: true,
    stackable: true,
    applicationMode: 'automatic',
    priority: 10,

    description:
      'Áp dụng mức chiết khấu bậc thang theo tổng giá trị các SKU Xương Gặm được chỉ định.',

    customerNote:
      'Đối với đại lý nhập nhiều đơn hàng trong tháng: nếu đơn hàng sau có giá trị thấp hơn đơn hàng trước liền kề, vẫn sẽ được áp dụng chung mức chiết khấu với đơn hàng trước.',

    startDate: '2026-08-15',
    endDate: '2026-09-30',

    condition: {
      categoryId: 'xuong-gam',
      categoryName: 'Xương Gặm',

      /**
       * ======================================================
       * QUAN TRỌNG:
       * CHỈ NHỮNG SKU NÀY THAM GIA CHƯƠNG TRÌNH
       * ======================================================
       *
       * Bạn thay danh sách này bằng SKU thực tế
       * mà sếp chỉ định.
       */
      targetSkus: [
        'B03', 'B06', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'D01', 'D02', 'D03', 'DB01', 'DB02', 'DB03', 'DB04', 'DB05', 'DB06', 'C10', 'C10-1', 'C11', 'C14', 'C14-1', 'C17', 'C22', 'C24', 'C28', 'C33','C34','C35', 'C36', 'C37', 'C38', 'C39', 'C41', 'C42'
      ],

      tiers: [
        {
          minAmount: 3_000_000,
          discountPercent: 6,
        },
        {
          minAmount: 5_000_000,
          discountPercent: 7,
        },
        {
          minAmount: 8_000_000,
          discountPercent: 8,
        },
        {
          minAmount: 12_000_000,
          discountPercent: 9,
        },
        {
          minAmount: 20_000_000,
          discountPercent: 11,
        },
        {
          minAmount: 30_000_000,
          discountPercent: 12,
        },
        {
          minAmount: 40_000_000,
          discountPercent: 13,
        },
        {
          minAmount: 50_000_000,
          discountPercent: 14,
        },
      ],
    },
  },

  /* ==========================================================
   * 2. GIÁ HỖ TRỢ ĐẶC BIỆT XƯƠNG BÀN CHẢI 15K (TỰ ĐỘNG)
   * ========================================================== */
  {
    id: 'xuong-ban-chai-tro-gia-15k',
    name: 'Giá bán hỗ trợ Xương Bàn Chải (15.000đ)',
    type: 'product_fixed_price',

    active: true,
    stackable: true,
    applicationMode: 'automatic',
    priority: 5,

    description:
      'Áp dụng giá 15.000đ/sản phẩm cho tất cả các SKU Xương Bàn Chải khi mua đủ vị.',

    customerNote:
      'Đại lý mua sản phẩm xương bàn chải đủ các vị trong thời gian từ 15/08 - 31/08/2026 sẽ được áp dụng chính sách giá đặc biệt 15.000 VNĐ.',

    startDate: '2026-08-15',
    endDate: '2026-08-31',

    condition: {
      targetSkus: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06'],
      requireAllSkus: true,
    },

    reward: {
      customPrice: 15_000,
    },
  },

  /* ==========================================================
   * 3. COMBO BÁNH THƯỞNG MUA 7 TẶNG 1 (LIÊN HỆ SALE)
   * ========================================================== */
  {
    id: 'combo-banh-thuong-buy-7-get-1',
    name: 'Combo Bánh Thưởng (Mua 7 tặng 1)',
    type: 'manual_sales',

    active: true,
    stackable: true,
    applicationMode: 'manual_sales',
    priority: 20,

    description:
      'Áp dụng chương trình Mua 7 tặng 1 (sản phẩm cùng loại) cho Combo 9 bánh thưởng.',

    customerNote:
      'Khi khách hàng mua kèm đơn Combo 9 sản phẩm bánh thưởng bao gồm cả 3 thương hiệu Lapati, Dexinbone và INU sẽ được áp dụng chương trình đặc biệt: Mua 7 tặng 1 (sản phẩm cùng loại).',

    contactNote:
      'Liên hệ Sale để được hỗ trợ áp dụng quà tặng trực tiếp vào đơn hàng.',

    startDate: '2026-08-15',
    endDate: '2026-08-31',
  },
];

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

/**
 * Lấy danh sách Promotion cần liên hệ Sale/NVKD.
 */
export function getSalesPromotions(
  date = new Date()
): Promotion[] {
  return getActivePromotions(date).filter(
    (p) =>
      p.applicationMode === 'manual_sales'
  );
}

/**
 * Lấy Promotion theo ID.
 */
export function getPromotionById(
  promoId: string
): Promotion | undefined {
  return PROMOTIONS.find(
    (p) => p.id === promoId
  );
}