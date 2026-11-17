const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const store = require('./store');
const otpService = require('./otp.service');
const mailer = require('./mailer');
const { getSetting, clearSettingsCache } = require('./db');

const app = express();

// Security Helper: Escape HTML to prevent injection in email templates
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Internal API Key Validation Middleware
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.API_KEY || 'lapet-internal-secret-otp-key';

function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['x-internal-key'] || req.query?.apiKey;
  if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_API_KEY === 'true') {
    if (!apiKey || apiKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid internal API key' });
    }
  }
  next();
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ giao diện kiểm thử trực quan tại thư mục public
app.use(express.static(path.join(__dirname, '../public')));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-client.html'));
});

// 1. Healthcheck Endpoint
app.get('/health', async (req, res) => {
  const smtpConfig = await getSetting('smtp_config');
  const notifConfig = await getSetting('notification_config');
  res.json({
    status: 'OK',
    service: 'email-otp-service',
    timestamp: new Date().toISOString(),
    store: store.isUsingRedis() ? 'Redis' : 'In-Memory (RAM)',
    smtpConfigured: !!(smtpConfig?.user && smtpConfig?.password),
    adminNotificationEmailConfigured: !!(notifConfig?.admin_email),
  });
});

// 1.1 Reload Config Endpoint (Admin gọi khi cập nhật cài đặt trong CSDL)
app.post('/api/reload-config', async (req, res) => {
  try {
    clearSettingsCache();
    await mailer.getTransporter(true);
    return res.json({
      success: true,
      message: 'Đã tải lại cấu hình SMTP & Email từ CSDL thành công',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 1.2 Test SMTP Endpoint (Admin gọi từ trang Cài đặt để kiểm tra gửi mail thật)
app.post('/api/test-smtp', async (req, res) => {
  try {
    const { target_email } = req.body || {};
    const notifConfig = await getSetting('notification_config', true);
    const smtpConfig = await getSetting('smtp_config', true);
    const companyInfo = await getSetting('company_info');

    const destination = (target_email || notifConfig?.admin_email || companyInfo?.email || '').trim();
    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'Chưa có địa chỉ email nhận thư thử nghiệm. Vui lòng cấu hình Email Admin trong Cài đặt.',
      });
    }

    const transporter = await mailer.getTransporter(true);
    if (!transporter) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình tài khoản (User) hoặc mật khẩu (App Password) máy chủ SMTP trong CSDL.',
      });
    }

    const senderName = smtpConfig?.sender_name || 'Hệ Thống LA PET B2B';
    const senderEmail = smtpConfig?.sender_email || smtpConfig?.user;
    const from = `"${senderName}" <${senderEmail}>`;

    const info = await transporter.sendMail({
      from,
      to: destination,
      subject: `[LA PET B2B] Kiểm tra kết nối Máy chủ Email (SMTP) - ${new Date().toLocaleString('vi-VN')}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #087b80;">✅ Kết nối Máy chủ SMTP Thành Công!</h2>
          <p>Email này được gửi thử nghiệm trực tiếp từ cấu hình SMTP lưu trong cơ sở dữ liệu hệ thống LA PET B2B.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
          <p><b>Máy chủ Host:</b> ${smtpConfig?.host || 'smtp.gmail.com'}:${smtpConfig?.port || 587}</p>
          <p><b>Tài khoản gửi:</b> ${senderEmail}</p>
          <p><b>Thời gian gửi:</b> ${new Date().toISOString()}</p>
        </div>
      `,
      text: `Kết nối Máy chủ SMTP thành công! Gửi từ ${senderEmail} đến ${destination}.`,
    });

    return res.json({
      success: true,
      message: `Đã gửi email thử nghiệm thành công tới ${destination}! (MessageId: ${info.messageId})`,
    });
  } catch (err) {
    console.error('[Test SMTP Error]:', err);
    return res.status(500).json({
      success: false,
      error: `Lỗi kết nối máy chủ SMTP: ${err.message}`,
    });
  }
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
    const { email, otp } = req.body;
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

// 4. API Thông báo Quản trị viên: POST /api/notify-admin
app.post('/api/notify-admin', validateApiKey, async (req, res) => {
  try {
    const { type, title, subject, html, text, data } = req.body || {};

    // Đọc email Admin nhận thông báo từ DB app_settings
    const notifConfig = await getSetting('notification_config');
    const companyInfo = await getSetting('company_info');
    const targetAdmin = (notifConfig?.admin_email || companyInfo?.email || '').trim();

    if (!targetAdmin) {
      console.warn('[Notify Admin] ⚠️ Chưa cấu hình Email Quản Trị trong app_settings. Bỏ qua gửi thông báo.');
      return res.status(200).json({
        success: false,
        message: 'Chưa cấu hình Email Quản Trị Viên trong cơ sở dữ liệu',
      });
    }

    const notificationTitle = escapeHtml(title || (type === 'dealer_registration' ? 'Đăng ký đại lý mới' : 'Thông báo mới'));
    const safeStoreName = escapeHtml(data?.store_name || data?.name || data?.full_name || '');
    const mailSubject =
      subject ||
      `[LA PET B2B] ${notificationTitle}: ${safeStoreName}`.trim();

    let emailHtml = html;
    let emailText = text;

    if (!emailHtml && data) {
      emailHtml = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="utf-8">
          <title>${notificationTitle}</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background-color: #087b80; padding: 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700;">${notificationTitle}</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Cổng Thương Mại Điện Tử B2B LA PET</p>
            </div>
            <div style="padding: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 8px; font-weight: 600; color: #64748b; width: 150px; border-bottom: 1px solid #f1f5f9;">Người liên hệ:</td>
                  <td style="padding: 10px 8px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.name || data.full_name || '(Chưa nhập)')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 8px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Số điện thoại:</td>
                  <td style="padding: 10px 8px; color: #087b80; font-weight: 700; border-bottom: 1px solid #f1f5f9;"><a href="tel:${escapeHtml(data.phone)}" style="color: #087b80; text-decoration: none;">${escapeHtml(data.phone || '(Chưa nhập)')}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 8px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Tên cửa hàng:</td>
                  <td style="padding: 10px 8px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.store_name || '(Chưa nhập)')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 8px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Khu vực / Tỉnh thành:</td>
                  <td style="padding: 10px 8px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.city || data.city_province || '(Chưa nhập)')}</td>
                </tr>
                ${data.email ? `
                <tr>
                  <td style="padding: 10px 8px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Email:</td>
                  <td style="padding: 10px 8px; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${escapeHtml(data.email)}" style="color: #2563eb;">${escapeHtml(data.email)}</a></td>
                </tr>` : ''}
                ${(data.note || data.notes) ? `
                <tr>
                  <td style="padding: 10px 8px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Ghi chú:</td>
                  <td style="padding: 10px 8px; color: #334155; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.note || data.notes)}</td>
                </tr>` : ''}
              </table>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Email tự động gửi từ hệ thống B2B LA PET</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    if (!emailText && data) {
      emailText = `[LA PET B2B] ${notificationTitle}\n- Người liên hệ: ${data.name || data.full_name || ''}\n- Số điện thoại: ${data.phone || ''}\n- Cửa hàng: ${data.store_name || ''}\n- Khu vực: ${data.city || data.city_province || ''}\n- Email: ${data.email || ''}\n- Ghi chú: ${data.note || data.notes || ''}`;
    }

    const transporter = await mailer.getTransporter();
    const smtpConfig = await getSetting('smtp_config');

    if (!transporter) {
      console.log('---------------------------------------------------------');
      console.log(`[MÔ PHỎNG GỬI MAIL ADMIN] Đến: ${targetAdmin}`);
      console.log(`Tiêu đề: ${mailSubject}`);
      console.log(`Nội dung:\n${emailText || mailSubject}`);
      console.log('---------------------------------------------------------');
      return res.status(200).json({
        success: true,
        message: 'Notification sent',
        simulated: true,
        to: targetAdmin,
        subject: mailSubject,
      });
    }

    const senderName = smtpConfig?.sender_name || 'Hệ Thống LA PET B2B';
    const senderEmail = smtpConfig?.sender_email || smtpConfig?.user;
    const from = `"${senderName}" <${senderEmail}>`;

    const info = await transporter.sendMail({
      from,
      to: targetAdmin,
      subject: mailSubject,
      html: emailHtml,
      text: emailText,
    });

    console.log(`[Mailer] ✅ Đã gửi email thông báo quản trị tới: ${targetAdmin} (MessageId: ${info.messageId})`);
    return res.status(200).json({
      success: true,
      message: 'Notification sent',
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Lỗi khi xử lý notify-admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra từ máy chủ khi gửi thông báo quản trị.',
      error: error.message,
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
