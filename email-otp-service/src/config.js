require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    // Tự động xóa mọi khoảng trắng trong mật khẩu ứng dụng Google (nếu người dùng copy paste dạng abcd efgh ...)
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    from: process.env.SMTP_FROM || `"Hệ Thống Xác Thực" <${process.env.SMTP_USER || 'no-reply@auth.local'}>`,
  },
  otp: {
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10), // 5 phút
    cooldownSeconds: parseInt(process.env.OTP_COOLDOWN_SECONDS || '60', 10), // 60 giây
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10), // Tối đa 5 lần nhập sai
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
};
