import { otpStore } from '@/lib/otp-store';

export const otpService = {
  async sendOTP(phone: string) {
    // Tạo mã OTP ngẫu nhiên 6 chữ số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu mã OTP vào bộ nhớ tạm (OTP Store)
    otpStore.setOTP(phone, otp);

    // Bật log trong Terminal để lấy mã OTP test
    console.log(`==========================================`);
    console.log(`[DEV OTP] Mã OTP gửi tới SĐT ${phone}: ${otp}`);
    console.log(`==========================================`);

    // Trong môi trường DEV hoặc chưa cấu hình nhà mạng SMS: trả về thành công ngay
    return {
      success: true,
      message: 'Mã OTP đã được tạo thành công.',
      otp,
    };
  },

  async verifyOTP(phone: string, otp: string) {
    return otpStore.verifyOTP(phone, otp);
  },
};