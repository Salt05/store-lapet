// src/utils/auth.ts

// Hàm đọc giá trị của Cookie theo tên
export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

// Hàm kiểm tra xem người dùng có phải là Đại lý / B2B hay không
export const isB2BUser = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. Kiểm tra qua Cookie (Dựa theo dữ liệu thực tế từ hệ thống của bạn)
  const partnerId = getCookie('partner_id');
  const sessionId = getCookie('session_id');

  if (partnerId || sessionId) {
    return true;
  }

  // 2. Dự phòng kiểm tra qua LocalStorage / SessionStorage
  try {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_info') || sessionStorage.getItem('user_info');
    if (token || userStr) return true;
  } catch {
    // Ignore error
  }

  return false;
};

// Hàm lấy thông tin Partner ID hiện tại
export const getPartnerId = (): string | null => {
  return getCookie('partner_id');
};

// Hàm xử lý Đăng xuất
export const logout = () => {
  if (typeof document === 'undefined') return;

  // Xóa Cookie đăng nhập bằng cách cho hết hạn
  document.cookie = 'partner_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

  // Xóa thêm LocalStorage nếu có
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');

  // Bắn sự kiện đồng bộ lại giao diện ngay lập tức
  window.dispatchEvent(new Event('auth-changed'));
};

export const getDisplayPrice = (retail: number, wholesale: number): number => {
  if (isB2BUser() && wholesale > 0) return wholesale;
  return retail;
};