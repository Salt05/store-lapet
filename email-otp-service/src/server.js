const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const store = require('./store');
const otpService = require('./otp.service');

const app = express();

// Middleware
app.use(cors()); // Mở CORS cho tất cả domain gọi tới (có thể cấu hình whitelist trong tương lai)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ giao diện kiểm thử trực quan tại thư mục public
app.use(express.static(path.join(__dirname, '../public')));

// Root route: Tự động chuyển hướng hoặc hiển thị trang demo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-client.html'));
});

// 1. Healthcheck Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'email-otp-service',
    timestamp: new Date().toISOString(),
    store: store.isUsingRedis() ? 'Redis' : 'In-Memory (RAM)',
    smtpConfigured: !!(config.smtp.user && config.smtp.pass),
  });
});

// 2. API Yêu cầu gửi mã OTP: POST /api/send-otp
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await otpService.requestOtp(email);
    return res.status(result.status).json(result.data);
  } catch (error) {
    console.error('Lỗi khi xử lý send-otp:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra từ máy chủ khi gửi mã xác nhận.',
    });
  }
});

// 3. API Xác thực mã OTP: POST /api/verify-otp
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email} = req.body;
    const { otp } = req.body;
    const result = await otpService.verifyOtp(email, otp);
    return res.status(result.status).json(result.data);
  } catch (error) {
    console.error('Lỗi khi xử lý verify-otp:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra từ máy chủ khi xác thực mã.',
    });
  }
});

// Khởi động Server
app.listen(config.port, () => {
  console.log('===============================================================');
  console.log(`🚀 Email OTP Service đang chạy tại: http://localhost:${config.port}`);
  console.log(`🌐 Trang web thử nghiệm: http://localhost:${config.port}/test-client.html`);
  console.log(`🩺 Kiểm tra sức khỏe: http://localhost:${config.port}/health`);
  console.log('===============================================================');
});
