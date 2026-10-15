const crypto = require('crypto');
const config = require('./config');
const store = require('./store');
const mailer = require('./mailer');

class OtpService {
  /**
   * Sinh mã ngẫu nhiên an toàn gồm đúng 6 chữ số (100000 -> 999999)
   */
  generateCode() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Chuẩn hóa email (viết thường, loại bỏ khoảng trắng thừa)
   */
  normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  /**
   * Kiểm tra định dạng email hợp lệ
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Yêu cầu gửi mã OTP tới email
   */
  async requestOtp(rawEmail) {
    const email = this.normalizeEmail(rawEmail);

    if (!email || !this.isValidEmail(email)) {
      return {
        status: 400,
        data: { success: false, message: 'Địa chỉ email không hợp lệ.' },
      };
    }

    const cooldownKey = `cooldown:${email}`;
    const otpKey = `otp:${email}`;

    // 1. Kiểm tra Cooldown chống spam
    const hasCooldown = await store.get(cooldownKey);
    if (hasCooldown) {
      return {
        status: 429,
        data: {
          success: false,
          message: `Vui lòng đợi ${config.otp.cooldownSeconds} giây trước khi yêu cầu mã mới.`,
        },
      };
    }

    // 2. Sinh mã 6 số ngẫu nhiên
    const otpCode = this.generateCode();

    // 3. Lưu vào Store (Redis hoặc In-Memory)
    const otpPayload = {
      code: otpCode,
      attempts: 0,
      createdAt: Date.now(),
    };

    await store.set(otpKey, otpPayload, config.otp.expirySeconds);
    await store.set(cooldownKey, '1', config.otp.cooldownSeconds);

    // 4. Gửi email
    const mailResult = await mailer.sendOtp(email, otpCode);

    if (!mailResult.success) {
      // Nếu gửi mail thất bại do lỗi SMTP thì xóa cooldown để người dùng thử lại
      await store.del(cooldownKey);
      return {
        status: 500,
        data: {
          success: false,
          message: `Lỗi khi gửi email: ${mailResult.error || 'Không thể kết nối máy chủ gửi mail.'}`,
        },
      };
    }

    return {
      status: 200,
      data: {
        success: true,
        message: 'Mã xác nhận đã được gửi thành công tới email của bạn.',
        email,
        expiresInSeconds: config.otp.expirySeconds,
        cooldownSeconds: config.otp.cooldownSeconds,
        simulated: mailResult.simulated || false,
      },
    };
  }

  /**
   * Kiểm tra và xác thực mã OTP
   */
  async verifyOtp(rawEmail, inputCode) {
    const email = this.normalizeEmail(rawEmail);
    const code = (inputCode || '').toString().trim();

    if (!email || !this.isValidEmail(email)) {
      return {
        status: 400,
        data: { success: false, message: 'Địa chỉ email không hợp lệ.' },
      };
    }

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return {
        status: 400,
        data: { success: false, message: 'Mã xác nhận phải gồm đúng 6 chữ số.' },
      };
    }

    const otpKey = `otp:${email}`;
    const otpData = await store.get(otpKey);

    // 1. Kiểm tra tồn tại / hết hạn
    if (!otpData) {
      return {
        status: 400,
        data: {
          success: false,
          message: 'Mã xác thực không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.',
        },
      };
    }

    // 2. Kiểm tra số lần thử sai (Chống Brute-force)
    if (otpData.attempts >= config.otp.maxAttempts) {
      await store.del(otpKey);
      return {
        status: 400,
        data: {
          success: false,
          message: `Bạn đã nhập sai quá ${config.otp.maxAttempts} lần. Mã đã bị hủy vì lý do an toàn.`,
        },
      };
    }

    // 3. So sánh mã
    if (otpData.code !== code) {
      otpData.attempts += 1;
      const remainingAttempts = config.otp.maxAttempts - otpData.attempts;

      if (remainingAttempts <= 0) {
        await store.del(otpKey);
        return {
          status: 400,
          data: {
            success: false,
            message: `Bạn đã nhập sai quá ${config.otp.maxAttempts} lần. Mã đã bị hủy.`,
          },
        };
      }

      // Cập nhật lại số lần sai vào store
      await store.set(otpKey, otpData, config.otp.expirySeconds);

      return {
        status: 400,
        data: {
          success: false,
          message: `Mã xác nhận không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
          remainingAttempts,
        },
      };
    }

    // 4. Khớp mã thành công -> Xóa mã ngay lập tức (One-time use)
    await store.del(otpKey);
    await store.del(`cooldown:${email}`);

    console.log(`[OtpService] ✅ Xác thực mã OTP thành công cho email: ${email}`);

    return {
      status: 200,
      data: {
        success: true,
        message: 'Xác thực mã OTP thành công!',
        email,
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}

module.exports = new OtpService();
