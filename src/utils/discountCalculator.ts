// src/utils/discountCalculator.ts
import { DISCOUNT_CONFIG, type CategoryTier, type CategoryPolicy } from '../config/discounts';

export interface UpsellResult {
  currentDiscountPercent: number;
  discountAmount: number;
  upsellInfo: {
    nextMinAmount: number;
    nextDiscountPercent: number;
    amountNeeded: number;
    additionalSavings: number;
  } | null;
}

export function calculateCategoryDiscount(categoryId: string, categoryTotalAmount: number): UpsellResult {
  const policy = DISCOUNT_CONFIG.categoryPolicies.find(
    (p: CategoryPolicy) => p.categoryId === categoryId && p.active
  );

  if (!policy || !policy.tiers || policy.tiers.length === 0) {
    return { currentDiscountPercent: 0, discountAmount: 0, upsellInfo: null };
  }

  // Sắp xếp các mốc tiền tăng dần
  const sortedTiers = [...policy.tiers].sort((a, b) => a.minAmount - b.minAmount);

  let currentTier: CategoryTier | null = null;
  let nextTier: CategoryTier | null = null;

  for (let i = 0; i < sortedTiers.length; i++) {
    if (categoryTotalAmount >= sortedTiers[i].minAmount) {
      currentTier = sortedTiers[i];
    } else {
      nextTier = sortedTiers[i];
      break; 
    }
  }

  const currentDiscountPercent = currentTier ? currentTier.discountPercent : 0;
  const discountAmount = (categoryTotalAmount * currentDiscountPercent) / 100;

  // Tính thông số gợi ý Mua Thêm (Upsell)
  let upsellInfo = null;
  if (nextTier) {
    const amountNeeded = nextTier.minAmount - categoryTotalAmount;
    
    // Tổng số tiền tiết kiệm dự kiến nếu đạt mốc tiếp theo
    const potentialDiscount = (nextTier.minAmount * nextTier.discountPercent) / 100;
    const additionalSavings = potentialDiscount - discountAmount;

    upsellInfo = {
      nextMinAmount: nextTier.minAmount,
      nextDiscountPercent: nextTier.discountPercent,
      amountNeeded: amountNeeded,
      additionalSavings: additionalSavings
    };
  }

  return {
    currentDiscountPercent,
    discountAmount,
    upsellInfo
  };
}