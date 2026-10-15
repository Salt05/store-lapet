const nodemailer = require('nodemailer');
const config = require('./config');

class MailerService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const { host, port, user, pass } = config.smtp;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      console.log(`[Mailer] ✅ SMTP đã cấu hình sẵn sàng (${user} qua ${host}:${port})`);
    } else {
      console.log(
        '[Mailer] ⚠️  Chưa cấu hình SMTP_USER và SMTP_PASS trong .env -> Đang chạy ở chế độ MÔ PHỎNG (Mã OTP sẽ được in trực tiếp ra màn hình Terminal).',
      );
    }
  }

  generateHtmlTemplate(otpCode, expiryMinutes) {
    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mã xác thực OTP</title>
      </head>
      <body style="margin: 0; padding: 30px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
                <!-- Header Banner -->
                <tr>
                  <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f8fafc;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background-color: #eff6ff; border-radius: 50%; margin-bottom: 12px;">
                      <span style="font-size: 24px;">🔒</span>
                    </div>
                    <h1 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">Xác Thực Tài Khoản</h1>
                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.5;">Vui lòng nhập mã bảo mật dưới đây để hoàn tất đăng nhập/xác nhận.</p>
                  </td>
                </tr>

                <!-- OTP Code Box -->
                <tr>
                  <td style="padding: 28px 32px; text-align: center;">
                    <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                      <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #2563eb; font-family: 'Courier New', monospace; display: inline-block; padding-left: 10px;">
                        ${otpCode}
                      </span>
                    </div>

                    <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
                      ⏱️ Mã có hiệu lực trong vòng <strong>${expiryMinutes} phút</strong>.
                    </p>
                    <p style="margin: 6px 0 0 0; color: #e11d48; font-size: 12px; font-weight: 500;">
                      ⚠️ Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ với bộ phận hỗ trợ.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  async sendOtp(email, otpCode) {
    const expiryMinutes = Math.round(config.otp.expirySeconds / 60);
    const subject = `[Mã xác thực] ${otpCode} là mã bảo mật của bạn`;
    const html = this.generateHtmlTemplate(otpCode, expiryMinutes);
    const text = `Mã xác thực OTP của bạn là: ${otpCode}. Mã có hiệu lực trong vòng ${expiryMinutes} phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.`;

    if (!this.transporter) {
      console.log('---------------------------------------------------------');
      console.log(`[MÔ PHỎNG GỬI MAIL] Đến: ${email}`);
      console.log(`👉 MÃ OTP 6 SỐ: [ ${otpCode} ] (Hết hạn sau ${expiryMinutes} phút)`);
      console.log('---------------------------------------------------------');
      return { success: true, simulated: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject,
        html,
        text,
      });

      console.log(`[Mailer] ✅ Đã gửi email OTP tới: ${email} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[Mailer] ❌ Lỗi khi gửi mail tới ${email}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MailerService();
