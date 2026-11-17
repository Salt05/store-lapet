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
  categoryPolicies: [] as CategoryPolicy[]
};
