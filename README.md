# 🐾 La Pet B2B Storefront & Management System

> **Hệ thống thương mại điện tử B2B & Quản trị bán sỉ chuyên dụng cho ngành thú cưng (Pet Supplies Wholesale Platform).**

[![Astro](https://img.shields.io/badge/Astro-5.x%20SSR-BC52EE.svg?style=flat-square&logo=astro&logoColor=white)](https://astro.build/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38BDF8.svg?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## 📖 Giới thiệu (Overview)

**La Pet Store B2B** là nền tảng thương mại điện tử B2B hoàn chỉnh kết hợp cổng thông tin đại lý và phân hệ ERP quản trị tinh gọn (Mini-ERP) dành cho các đơn vị phân phối phụ kiện, thực phẩm và đồ dùng thú cưng. 

Hệ thống được thiết kế giải quyết triệt để bài toán bán sỉ truyền thống: tự động hóa quy trình đặt hàng ma trận số lượng lớn, chính sách chiết khấu lũy tiến bậc thang theo hạn mức doanh số, kiểm soát tồn kho khoá dòng tức thời (ACID transactions), tích hợp cổng thanh toán trực tuyến (VNPAY Sandbox) và thông báo qua Email OTP an toàn.

---

## ✨ Tính năng nổi bật (Key Features)

### 🛒 Dành cho Khách hàng & Đại lý (B2B Storefront & Portal)
- **Ma trận đặt hàng nhanh (B2B Quick Order):** Cho phép đại lý nhập hàng hàng loạt theo SKU, hỗ trợ phím tắt điều hướng bàn phím (Enter, Tab, mũi tên), kiểm tra tồn kho tức thời.
- **Cơ chế chiết khấu bậc thang tự động:** Tính toán chiết khấu lũy tiến trực tiếp theo bậc doanh số quý/năm và quy mô đơn hàng (One-Step Checkout với dynamic pricing).
- **Cổng thông tin đại lý (Dealer Account Portal):** Theo dõi lịch sử đơn hàng, hành trình giao vận, tải hóa đơn/báo giá PDF/A4 và thống kê doanh số tích lũy trực quan.
- **Xác thực bảo mật Email OTP:** Đăng nhập không cần mật khẩu phức tạp qua mã OTP gửi về Email, giới hạn tần suất gửi (rate limiting) và tự động hết hạn an toàn.
- **Thanh toán linh hoạt:** Hỗ trợ thanh toán chuyển khoản quét mã VietQR tự động và cổng thanh toán trực tuyến VNPAY.

### 🛡️ Phân hệ Quản trị & Vận hành (Admin / Mini-ERP)
- **Bảng điều khiển kinh doanh (Dashboard Analytics):** Thống kê doanh thu, số lượng đơn hàng, Top SKU bán chạy nhất và tỷ lệ chuyển đổi đại lý.
- **Quản lý đơn hàng (Order Management):** Theo dõi trạng thái đơn hàng (Báo giá -> Xác nhận -> Đang giao -> Hoàn tất), xuất danh sách đơn ra Excel (UTF-8 BOM), in phiếu giao hàng chuẩn khổ A4 kèm mã thanh toán Napas247.
- **Quản trị kho vận (Inventory Operations):** Theo dõi tồn thực tế, tồn đang giữ chỗ (reserved), khả dụng (available), cảnh báo ngưỡng tối thiểu và hỗ trợ phiếu nhập/xuất kho.
- **Quản lý đại lý & Duyệt nhanh:** Xét duyệt đơn đăng ký đại lý, phân nhóm chiết khấu và tự động cấp mã định danh đại lý.
- **Cấu hình hệ thống:** Tùy biến thông tin doanh nghiệp, tài khoản ngân hàng thụ hưởng VietQR và thông số SMTP.

---

## 🏗️ Kiến trúc & Công nghệ (Tech Stack)

```
┌─────────────────────────────────────────────────────────────┐
│                       STOREFRONT CLIENT                     │
│        Astro 5.x SSR + Tailwind CSS v4 + Alpine.js          │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API
┌──────────────────────────────▼──────────────────────────────┐
│                  ASTRO SSR BACKEND (Node.js)                │
│    Auth Middleware • Order Engine • Pricing & Promo Engine  │
│                   VNPAY Gateway Service                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼─────────────┐ ┌──────────────▼──────────────┐
│       POSTGRESQL 16        │ │      EMAIL OTP SERVICE      │
│  Atomic Transactions (ACID)│ │    Node.js Express / Redis  │
│   Row-level Locking        │ │       Nodemailer SMTP       │
└────────────────────────────┘ └─────────────────────────────┘
```

- **Frontend & SSR Framework:** [Astro 5.x](https://astro.build/) với chế độ Server-Side Rendering (`@astrojs/node`).
- **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/) với `@tailwindcss/vite`, thiết kế hiện đại, responsive từ Smartphone (390px) đến Desktop (1440px).
- **Interactivity:** [Alpine.js](https://alpinejs.dev/) tối ưu hiệu năng, không tải nặng client runtime.
- **Database:** [PostgreSQL 16](https://www.postgresql.org/) với thiết kế chuẩn hóa, khóa dòng giao dịch nghiêm ngặt (`BEGIN`, `FOR UPDATE`, `COMMIT`) chống bán vượt tồn (overselling).
- **Caching & OTP:** Redis + Node.js Microservice phụ trách xác thực OTP độc lập.
- **Containerization:** Docker & Docker Compose sẵn sàng triển khai môi trường production.

---

## 📁 Cấu trúc thư mục (Directory Structure)

```text
store-lapet/
├── docker-compose.yml           # Cấu hình cụm dịch vụ (PostgreSQL, Redis, OTP, Web)
├── Dockerfile                   # Docker build cho ứng dụng Astro SSR
├── email-otp-service/           # Microservice gửi và xác thực mã OTP qua Email
├── public/                      # Static assets, banner, icons, robots.txt
├── scripts/                     # Scripts khởi tạo DB, migration dữ liệu
│   └── setup_clean_b2b_database.mjs
├── src/
│   ├── components/              # Reusable UI components (Header, Footer, Product, Common)
│   ├── config/                  # Bảng chính sách chiết khấu, hạn mức doanh số
│   ├── layouts/                 # BaseLayout, AdminLayout, AuthLayout, AccountLayout
│   ├── lib/                     # Database connection pool (src/lib/db.ts), Auth, Catalog
│   ├── pages/                   # File-based routing (SSR)
│   │   ├── admin/               # Các trang giao diện Quản trị / Mini-ERP
│   │   ├── api/                 # REST Endpoints (Auth, Orders, Products, Payment, Admin)
│   │   ├── auth/                # Trang Đăng nhập, Đăng ký đại lý
│   │   ├── san-pham/            # Danh mục & Chi tiết sản phẩm sỉ
│   │   ├── tai-khoan/           # Cổng thông tin tài khoản đại lý
│   │   ├── dat-hang-nhanh.astro # Giao diện ma trận đặt hàng SKU
│   │   ├── gio-hang.astro       # Giỏ hàng & thanh chiết khấu lũy tiến
│   │   ├── thanh-toan.astro     # One-step checkout & chọn cổng thanh toán
│   │   └── hoan-tat.astro       # Xác nhận đơn hàng & hóa đơn thanh toán
│   ├── services/                # Business logic layer (Order, Customer, Product, Inventory, VNPAY)
│   └── styles/                  # Tailwind CSS configuration & Global stylesheet
└── package.json
```

---

## 🚀 Hướng dẫn cài đặt & Chạy dự án (Getting Started)

### 1. Yêu cầu hệ thống (Prerequisites)
- **Node.js:** phiên bản `18.x` hoặc `20.x+`
- **PostgreSQL:** `16+` (hoặc Docker)
- **Redis:** `6.x+` (cho OTP service)

### 2. Cài đặt biến môi trường (Environment Variables)
Sao chép file `.env.example` thành `.env`:
```bash
cp .env.example .env
cp email-otp-service/.env.example email-otp-service/.env
```

Cấu hình các thông số cơ bản trong `.env`:
```ini
PORT=4321
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/store_lapet

# Session & Secrets
SESSION_SECRET=your_strong_random_session_secret_key_here
ADMIN_JWT_SECRET=your_strong_admin_jwt_secret_key_here

# Services
OTP_SERVICE_URL=http://localhost:4000
OTP_INTERNAL_API_KEY=your_internal_api_key

# Payment Gateway (VNPAY Sandbox)
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:4321/api/payment/vnpay-callback
```

### 3. Cài đặt Dependencies & Khởi tạo CSDL
```bash
# Cài đặt thư viện cho web chính
npm install

# Cài đặt thư viện cho email OTP service
cd email-otp-service && npm install && cd ..

# Khởi tạo Schema CSDL & Dữ liệu mẫu (nếu chạy DB mới)
node scripts/setup_clean_b2b_database.mjs
```

### 4. Chạy chế độ Development
Có thể khởi động toàn bộ dịch vụ nhanh bằng script hoặc chạy từng lệnh:

**Cách 1: Chạy từng service trong terminal riêng:**
```bash
# Terminal 1: Chạy OTP Service
cd email-otp-service && npm run dev

# Terminal 2: Chạy Astro Web
npm run dev
```

**Cách 2: Chạy bằng Docker Compose (Khuyên dùng cho Production/Staging):**
```bash
docker-compose up -d --build
```

Ứng dụng sẽ hoạt động tại:
- **B2B Storefront:** `http://localhost:4321`
- **Admin Mini-ERP:** `http://localhost:4321/admin`
- **Email OTP Service:** `http://localhost:4000`

---

## 🛠️ Scripts & Tiện ích (Available Scripts)

| Lệnh | Mô tả |
| :--- | :--- |
| `npm run dev` | Khởi chạy máy chủ phát triển cục bộ (Astro dev) |
| `npm run build` | Biên dịch bundle mã nguồn cho môi trường production |
| `npm run preview` | Khởi chạy bản build sản phẩm cục bộ để kiểm tra |
| `npm run astro ...` | Gọi các lệnh quản trị của Astro CLI |

---

## 🔒 Bảo mật & Tối ưu hóa (Security & Reliability)

- **ACID Transactions:** Mọi giao dịch đặt hàng, khóa tồn kho, cập nhật số dư đều được bảo vệ bởi giao dịch Database mức độ cô lập cao.
- **Xác thực & Phân quyền:** Middleware chặn truy cập trái phép vào các route `/admin/*` và `/tai-khoan/*`.
- **Bảo mật thanh toán:** Kiểm tra chữ ký HMAC-SHA512 đối với mọi gói tin phản hồi từ VNPAY IPN/Callback.
- **Sanitized Outputs:** Toàn bộ dữ liệu hiển thị và email gửi đi đều được mã hóa chống XSS và Injection.

---

## 📄 Bản quyền (License)

Dự án được phân phối dưới giấy phép **MIT License**. Mọi quyền được bảo lưu bởi đội ngũ phát triển La Pet.
