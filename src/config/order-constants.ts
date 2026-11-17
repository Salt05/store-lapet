// src/config/order-constants.ts
/**
 * Chuẩn hóa trạng thái đơn hàng (Fulfillment Status) & Trạng thái thanh toán (Payment Status) B2B
 * Dùng thống nhất giữa Admin, Đại lý và Backend APIs
 */

export const ORDER_STATUS = {
  DRAFT: 'draft', // Đơn nháp: khách hàng vẫn có thể chỉnh sửa
  CONFIRMED: 'confirmed', // Đơn bán hàng: khách đã chốt đơn, kho đang đóng gói và giao
  DELIVERED: 'delivered', // Đã giao: đơn hàng đã giao tới đại lý
  COMPLETED: 'completed', // Hoàn tất: đơn hàng đã giao + đã thanh toán đủ 100%
  CANCELLED: 'cancelled', // Đã hủy: đơn hàng bị hủy
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid', // Chưa thanh toán (paid_amount = 0)
  PARTIAL: 'partial', // Đã thanh toán một phần (0 < paid_amount < amount_total)
  PAID: 'paid', // Đã thanh toán đủ (paid_amount >= amount_total)
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const ORDER_STATUS_LABEL: Record<
  string,
  { label: string; color: string; desc: string }
> = {
  draft: {
    label: 'Đơn nháp',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    desc: 'Đại lý vẫn có thể chỉnh sửa số lượng / mặt hàng',
  },
  confirmed: {
    label: 'Đơn bán hàng',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    desc: 'Đã chốt đơn, đang đóng gói và vận chuyển',
  },
  delivered: {
    label: 'Đã giao hàng',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    desc: 'Đã giao hàng tới đại lý (đang theo dõi công nợ)',
  },
  completed: {
    label: 'Hoàn tất',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    desc: 'Đã giao hàng thành công và thanh toán đủ 100%',
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    desc: 'Đơn hàng đã hủy',
  },
};

export const PAYMENT_STATUS_LABEL: Record<
  string,
  { label: string; color: string; desc: string }
> = {
  unpaid: {
    label: 'Chưa thanh toán',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    desc: 'Chưa nhận được khoản thanh toán nào',
  },
  partial: {
    label: 'Thanh toán 1 phần',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    desc: 'Đã thanh toán một phần tiền hàng',
  },
  paid: {
    label: 'Đã thanh toán đủ',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    desc: 'Đã thanh toán 100% giá trị đơn hàng',
  },
};

