// src/pages/api/auth/send-otp.ts
import type { APIRoute } from 'astro';
import { customerService } from '@/services/customer.service';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const identifier = body?.identifier?.trim();

    // 1. Kiểm tra định dạng đầu vào
    if (!identifier || identifier.length < 5) {
      return new Response(
        JSON.stringify({ error: 'SĐT hoặc Email không hợp lệ.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Kiểm tra Đại lý trên Odoo theo SĐT hoặc Email
    const partner = await customerService.findPartnerByPhoneOrEmail(identifier);

    if (!partner) {
      return new Response(
        JSON.stringify({ error: 'Thông tin chưa được đăng ký quyền Đại lý trên hệ thống LA PET.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (partner.active === false) {
      return new Response(
        JSON.stringify({ error: 'Tài khoản đại lý này đang bị tạm khóa.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!partner.email) {
      return new Response(
        JSON.stringify({ error: 'Tài khoản chưa cập nhật Email trên hệ thống B2B LA PET. Vui lòng liên hệ Hotline.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Chuẩn hóa URL & Endpoint của Microservice gửi OTP
    const rawUrl =
      (typeof process !== 'undefined' && process.env?.EMAIL_OTP_SERVICE_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.EMAIL_OTP_SERVICE_URL) ||
      'http://127.0.0.1:4000';
    let baseUrl = rawUrl.trim().replace(/\/+$/, '');
    if (baseUrl.startsWith('http://localhost:')) {
      baseUrl = baseUrl.replace('http://localhost:', 'http://127.0.0.1:');
    }
    const targetUrl = `${baseUrl}/api/send-otp`;
    const targetEmail = partner.email.trim().toLowerCase();

    // 4. Gọi sang Microservice gửi OTP tới Email của Partner
    let otpRes: Response;
    try {
      otpRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          identifier: targetEmail,
        }),
      });
    } catch (fetchError: any) {
      console.error('[API Send-OTP Network Error] Không thể kết nối tới Email OTP Service:', fetchError?.message || fetchError);
      return new Response(
        JSON.stringify({ error: 'Không thể kết nối đến máy chủ gửi email OTP. Vui lòng đảm bảo dịch vụ email-otp-service đang chạy.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Xử lý và Parse phản hồi từ Microservice an toàn
    const responseText = await otpRes.text();
    let otpData: any = {};

    try {
      otpData = JSON.parse(responseText);
    } catch (e) {
      console.error('[API Send-OTP Error] Response không phải JSON từ Microservice:', responseText);
      return new Response(
        JSON.stringify({ error: 'Không thể xử lý phản hồi từ dịch vụ OTP.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!otpRes.ok) {
      return new Response(
        JSON.stringify({ error: otpData.message || otpData.error || 'Gửi mã OTP thất bại.' }),
        { status: otpRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Che mờ Email trước khi phản hồi về Client
    const displayEmail = targetEmail;
    const maskedEmail = displayEmail.replace(
      /(.{2})(.*)(?=@)/,
      (_match: string, gp1: string, gp2: string) => gp1 + '*'.repeat(gp2.length)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Mã OTP đã được gửi thành công đến email ${maskedEmail}!`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[API Send-OTP Exception]:', error);
    return new Response(
      JSON.stringify({ error: 'Lỗi máy chủ khi gửi mã OTP.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};