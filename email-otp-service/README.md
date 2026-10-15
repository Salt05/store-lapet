# 🔐 Dịch Vụ Độc Lập: Tạo & Xác Thực Mã OTP 6 Số Qua Email (`email-otp-service`)

Dịch vụ độc lập (Microservice) chuyên biệt cho việc **Tạo mã OTP 6 số ngẫu nhiên an toàn, gửi qua Email (Gmail/SMTP) và xác thực đăng nhập**.

---

## 🌟 Tính Năng Nổi Bật

- **Độc lập 100%**: Gom trọn vẹn trong một thư mục, có thể copy sang bất kỳ dự án hay máy chủ nào.
- **Tự động thích ứng (Adaptive In-Memory Fallback)**:
  - Nếu có **Redis**: Tự động dùng Redis với TTL chuẩn production.
  - Nếu **chưa cài Redis**: Tự động lưu trên RAM cục bộ, không báo lỗi, sẵn sàng cho việc thử nghiệm ngay lập tức.
- **Chế độ mô phỏng thông minh (Simulation Mode)**:
  - Nếu chưa kịp cấu hình SMTP Gmail: Mã OTP 6 số sẽ tự động in ra màn hình Terminal để bạn test giao diện ngay mà không cần chờ cấu hình mail.
- **Bảo mật**:
  - Mã sinh bằng `crypto.randomInt` an toàn.
  - Hết hạn sau 5 phút (TTL).
  - Giới hạn gửi lại sau 60 giây (Cooldown chống spam).
  - Tối đa 5 lần nhập sai mã (Chống Brute-force).
  - Hủy mã ngay sau khi xác thực thành công (One-time use).
- **Trang web thử nghiệm trực quan**: Tích hợp sẵn tại `http://localhost:4000/test-client.html`.

---

## 🚀 Cách Khởi Chạy

### Cách 1: Chạy trực tiếp bằng Node.js (Khuyên dùng khi dev)

1. Mở Terminal tại thư mục `email-otp-service`:
   ```bash
   cd email-otp-service
   ```
2. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```
3. Cấu hình file `.env` (điền Gmail và Mật khẩu ứng dụng 16 ký tự của bạn):
   ```env
   SMTP_USER=email_cua_ban@gmail.com
   SMTP_PASS=abcdefghijklmnop
   ```
4. Chạy server:
   ```bash
   npm start
   ```
5. Mở trình duyệt truy cập: **`http://localhost:4000`** để thử nghiệm ngay!

---

### Cách 2: Chạy bằng Docker Compose (Bao gồm cả Redis)

```bash
cd email-otp-service
docker-compose up -d
```
Hệ thống sẽ tự động tải Redis và khởi chạy container dịch vụ tại cổng `4000`.

---

## 📡 Tài Liệu REST API (Cách Kết Nối Từ Trang Web Khác)

### 1. Kiểm tra trạng thái máy chủ
- **URL**: `GET /health`
- **Phản hồi mẫu**:
  ```json
  {
    "status": "OK",
    "service": "email-otp-service",
    "store": "In-Memory (RAM)",
    "smtpConfigured": true
  }
  ```

---

### 2. Yêu cầu gửi mã OTP
- **URL**: `POST /api/send-otp`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "email": "khachhang@gmail.com"
  }
  ```
- **Phản hồi thành công (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Mã xác nhận đã được gửi thành công tới email của bạn.",
    "email": "khachhang@gmail.com",
    "expiresInSeconds": 300,
    "cooldownSeconds": 60
  }
  ```
- **Phản hồi khi bị giới hạn gửi lại (`429 Too Many Requests`)**:
  ```json
  {
    "success": false,
    "message": "Vui lòng đợi 60 giây trước khi yêu cầu mã mới."
  }
  ```

---

### 3. Xác thực mã OTP 6 số
- **URL**: `POST /api/verify-otp`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "email": "khachhang@gmail.com",
    "otp": "849201"
  }
  ```
- **Phản hồi thành công (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Xác thực mã OTP thành công!",
    "email": "khachhang@gmail.com",
    "verifiedAt": "2026-09-05T08:30:00.000Z"
  }
  ```
- **Phản hồi khi mã không đúng (`400 Bad Request`)**:
  ```json
  {
    "success": false,
    "message": "Mã xác nhận không chính xác. Bạn còn 4 lần thử.",
    "remainingAttempts": 4
  }
  ```

---

## 💻 Mã Mẫu Tích Hợp Vào Frontend Bất Kỳ (JavaScript / React / Vue)

```javascript
const OTP_API = 'http://localhost:4000/api';

// 1. Gửi mã OTP
async function sendOtp(email) {
  const res = await fetch(`${OTP_API}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return await res.json();
}

// 2. Xác nhận mã OTP
async function verifyOtp(email, otpCode) {
  const res = await fetch(`${OTP_API}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: otpCode })
  });
  return await res.json();
}
```
