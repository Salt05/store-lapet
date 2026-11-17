// src/pages/api/customers/change-password.ts
import type { APIRoute } from 'astro';
import { getAuthState, hashPassword, verifyPassword } from '@/lib/auth';
import { customerService } from '@/services/customer.service';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const authState = await getAuthState(context);
    if (!authState.isAuthenticated || !authState.partnerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng đăng nhập để thực hiện thao tác này.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json();
    const { oldPassword, newPassword, confirmPassword } = body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword !== confirmPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Xác nhận mật khẩu mới không trùng khớp.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partner = await customerService.getPartnerById(authState.partnerId);
    if (!partner || !partner.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy hồ sơ khách hàng.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Nếu tài khoản đã có mật khẩu trước đó, yêu cầu kiểm tra mật khẩu cũ
    if (partner.password_hash) {
      if (!oldPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'Vui lòng nhập mật khẩu hiện tại.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const isOldValid = verifyPassword(oldPassword, partner.password_hash);
      if (!isOldValid) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mật khẩu hiện tại không chính xác.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const newHash = hashPassword(newPassword.trim());
    const ok = await customerService.updatePassword(partner.id, newHash);

    if (!ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể cập nhật mật khẩu vào cơ sở dữ liệu.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: partner.password_hash ? 'Đổi mật khẩu thành công!' : 'Thiết lập mật khẩu mới thành công!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Change Password Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Lỗi hệ thống khi đổi mật khẩu.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
