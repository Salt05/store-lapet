// src/config/discounts.ts: Chính sách khuyến mãi ngắn hạn trong năm

export interface CategoryTier {
  minAmount: number;       // Giá trị mốc đơn hàng (VNĐ)
  discountPercent: number; // % Chiết khấu tương ứng
}

export interface CategoryPolicy {
  categoryId: string;   // Mã danh mục sản phẩm
  categoryName: string;
  active: boolean;
  tiers: CategoryTier[];
}

export const DISCOUNT_CONFIG = {
  // Chiết khấu cơ bản áp dụng trên giá lẻ đề xuất (MRP)
  baseDiscountPercent: 22, 

  // Danh mục áp dụng chiết khấu bậc thang theo tháng / chương trình ngắn hạn
  categoryPolicies: [
    {
      categoryId: 'xuong-gam', // Mã danh mục xương gặm
      categoryName: 'Xương Gặm',
      active: true,
      tiers: [
        { minAmount: 3_000_000, discountPercent: 4 },
        { minAmount: 5_000_000, discountPercent: 5 },
        { minAmount: 8_000_000, discountPercent: 7 },
        { minAmount: 12_000_000, discountPercent: 6 },
        { minAmount: 20_000_000, discountPercent: 8 },
        { minAmount: 40_000_000, discountPercent: 9 },
        { minAmount: 60_000_000, discountPercent: 10 },
        { minAmount: 100_000_000, discountPercent: 13 }
      ]
    }
  ] as CategoryPolicy[]
};