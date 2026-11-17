/**
 * API Type Definitions for LA PET B2B Storefront
 *
 * Covers Dealer Registration, Newsletter Subscription,
 * Newsletter Unsubscription, and Admin Notification microservice.
 */

// ============================================================================
// 1. Dealer Registration API (/api/dealers/register)
// ============================================================================

export interface DealerRegistrationRequest {
  /** Họ và tên người đại diện */
  name?: string;
  full_name?: string;
  'Họ và tên'?: string;
  ho_va_ten?: string;

  /** Số điện thoại liên hệ (10 chữ số Việt Nam) */
  phone?: string;
  'Số điện thoại'?: string;
  so_dien_thoai?: string;

  /** Mật khẩu đại lý */
  password?: string;
  mat_khau?: string;

  /** Tên cửa hàng / phòng khám / spa */
  store_name?: string;
  'Tên cửa hàng'?: string;
  ten_cua_hang?: string;

  /** Mô hình kinh doanh (Pet Shop, Phòng khám, Spa, v.v.) */
  business_model?: string;
  'Mô hình kinh doanh'?: string;
  mo_hinh_kinh_doanh?: string;

  /** Tỉnh / Thành phố / Khu vực */
  city?: string;
  city_province?: string;
  'Địa chỉ Tỉnh/Thành'?: string;
  dia_chi_tinh_thanh?: string;
  'Khu vực'?: string;

  /** Email liên hệ */
  email?: string;
  Email?: string;

  /** Ghi chú / mong muốn hợp tác */
  note?: string;
  notes?: string;
  'Ghi chú'?: string;
  ghi_chu?: string;

  /** Honeypot anti-spam (phải rỗng) */
  _honey?: string;
  [key: string]: any;
}

export interface DealerRegistrationResponse {
  success: boolean;
  message: string;
  id?: number;
  error?: string;
}

// ============================================================================
// 2. Admin Notification Microservice (/api/notify-admin)
// ============================================================================

export interface AdminNotifyDealerData {
  name?: string;
  full_name?: string;
  phone?: string;
  store_name?: string;
  business_model?: string;
  city?: string;
  city_province?: string;
  email?: string;
  note?: string;
  notes?: string;
  [key: string]: any;
}

export interface AdminNotifyRequest {
  type?: 'dealer_registration' | 'general' | string;
  title?: string;
  subject?: string;
  html?: string;
  text?: string;
  data?: AdminNotifyDealerData | Record<string, any>;
}

export interface AdminNotifyResponse {
  success: boolean;
  message: string;
  messageId?: string;
  simulated?: boolean;
  to?: string;
  subject?: string;
  error?: string;
}

// ============================================================================
// 5. Generic API Response Helper
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
