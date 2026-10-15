interface OTPRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
  resendAvailableAt: number;
}

const otpMap = new Map<string, OTPRecord>();

export const otpStore = {
  cleanPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('84')) {
      cleaned = '0' + cleaned.slice(2);
    }
    return cleaned;
  },

  setOTP(phone: string, otp: string, ttlSeconds = 300) {
    const cleanedPhone = this.cleanPhone(phone);
    const now = Date.now();
    otpMap.set(cleanedPhone, {
      otp,
      expiresAt: now + ttlSeconds * 1000,
      attempts: 0,
      resendAvailableAt: now + 60 * 1000,
    });
  },

  canResend(phone: string): { allowed: boolean; remainingSeconds: number } {
    const cleanedPhone = this.cleanPhone(phone);
    const record = otpMap.get(cleanedPhone);
    if (!record) return { allowed: true, remainingSeconds: 0 };

    const now = Date.now();
    if (now < record.resendAvailableAt) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil((record.resendAvailableAt - now) / 1000),
      };
    }
    return { allowed: true, remainingSeconds: 0 };
  },

  verifyOTP(phone: string, inputOTP: string): { success: boolean; message: string } {
    const cleanedPhone = this.cleanPhone(phone);
    const record = otpMap.get(cleanedPhone);

    if (!record) {
      return { success: false, message: 'Mã OTP không tồn tại hoặc đã hết hạn.' };
    }

    if (Date.now() > record.expiresAt) {
      otpMap.delete(cleanedPhone);
      return { success: false, message: 'Mã OTP đã hết hạn. Vui lòng xin mã mới.' };
    }

    if (record.attempts >= 5) {
      otpMap.delete(cleanedPhone);
      return { success: false, message: 'Bạn đã nhập sai quá 5 lần. Vui lòng xin mã OTP mới.' };
    }

    if (record.otp !== inputOTP.trim()) {
      record.attempts += 1;
      return {
        success: false,
        message: `Mã OTP không chính xác (Còn ${5 - record.attempts} lần thử).`,
      };
    }

    otpMap.delete(cleanedPhone);
    return { success: true, message: 'Xác thực thành công!' };
  },
};