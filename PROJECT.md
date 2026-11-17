# Project: La Pet Store B2B Full-Stack Transformation

## Architecture
- **Framework**: Astro SSR v7 (Node.js standalone adapter on port `4321`) + Tailwind CSS v4 (`@tailwindcss/vite`) + Alpine.js
- **Database & Infrastructure**:
  - Independent Docker Compose Stack:
    - `lapet-postgres`: PostgreSQL 16 (port `5434:5432`, volume `pgdata`, healthcheck active)
    - `lapet-redis`: Redis (port `6380:6379`, volume `redis_data`)
    - `lapet-otp`: Node.js Email OTP microservice (port `4000:4000`)
    - `lapet-store`: Astro SSR Storefront & Admin (port `4321:4321`)
  - Clean PostgreSQL 16 Schema (`src/lib/db.ts`):
    - Tables: `customers`, `customer_addresses`, `products`, `orders`, `order_items`, `inventory_items`, `inventory_receipts`, `inventory_transactions`, `promotion_configs`, `app_settings`
    - Zero `odoo_` prefixed tables or columns.
    - Foreign keys, indexes, auto-increment sequences, and phone uniqueness constraint.
- **Backend Core & Security**:
  - Elimination of Router Client (`src/services/router-client.ts`), `src/pages/api/router/health.ts` and `@supabase/supabase-js`.
  - Elimination of JSON storage (`src/data/inventory/`).
  - Core services (`customer.service.ts`, `product.service.ts`, `order.service.ts`, `inventory-storage.service.ts`, `promotionContextService.ts`) operate on atomic PostgreSQL Transactions (`BEGIN` / `SELECT ... FOR UPDATE` / `COMMIT`).
  - Strict security hardening across VNPAY, Auth OTP, Admin login backdoor eradication, Auth logout, and Email OTP service.
- **Design System Architecture**:
  - Clean Precision B2B Commerce with Warm Organic Accent.
  - Elimination of childish emojis, oversaturated gradients, and excessive `rounded-3xl` radii.
  - Consistent Lucide-style SVG icons, sharp typography (Inter), standardized card radius (`rounded-xl`).
  - 4 canonical viewports: Desktop (1440px), Laptop (1024px), Tablet (768px), Smartphone (390px).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Independent Docker Stack | `docker-compose.yml` & `Dockerfile` cho 4 dịch vụ: postgres (5434), redis (6380), otp (4000), store (4321) | M1 | survey |
| 2 | Clean PostgreSQL 16 Schema | Schema 10 bảng sạch tại `src/lib/db.ts` tuyệt đối không có tiền tố `odoo_` | M1 | survey |
| 3 | Odoo XML-RPC Migration Script | `scripts/migrate-from-odoo.mjs` chuyển partner, product, order, lines sang PostgreSQL | M1 | survey |
| 4 | Sequence Synchronization | Reset sequence PostgreSQL (`setval()`) sau khi import dữ liệu Odoo | M1 | survey |
| 5 | Remove Router & Supabase | Xóa hoàn toàn `router-client.ts`, `api/router/health.ts`, `@supabase/supabase-js`, `supabase.ts`, `callback.ts` | M2 | survey |
| 6 | PostgreSQL Transaction Services | Viết lại 5 core services sang PostgreSQL Transaction (`BEGIN` / `SELECT ... FOR UPDATE` / `COMMIT`) | M2 | survey |
| 7 | Purge JSON Inventory Files | Chấm dứt lưu trữ file JSON tại `src/data/inventory/` | M2 | survey |
| 8 | Consistent Order & Stock Transactions | Đặt hàng, giữ chỗ kho, tính đơn giá sau chiết khấu và cộng dồn doanh số nhất quán trong 1 transaction | M2 | survey |
| 9 | Security: VNPAY Simulate Guard | Khóa `vnpay-simulate.ts` trên môi trường PROD trả về 404 | M2 | survey |
| 10 | Security: VNPAY Amount Verification | `vnpay-create.ts` lấy `amount_total` từ DB; `vnpay.service.ts` đối soát số tiền và trả mã 01 nếu thiếu đơn | M2 | survey |
| 11 | Security: Auth OTP Sanitization | Xóa email hardcode `phathideptrai2k5@gmail.com`, normalize email, bật cookie `secure` trên PROD | M2 | survey |
| 12 | Security: Admin Backdoor Removal | Xóa bỏ tài khoản backdoor `admin@lapet.vn` / `admin` tại `admin/auth/login.ts` | M2 | survey |
| 13 | Security: Auth Logout Fix | Sửa `logout()` trong `src/utils/auth.ts` gọi `POST /api/auth/logout` | M2 | survey |
| 14 | Security: Email OTP Service Hardening | Kiểm tra internal API key, escape HTML trong `notify-admin`, cấu hình `rejectUnauthorized: true` trên PROD | M2 | survey |
| 15 | Header & Navigation Redesign | Header tinh giản, huy hiệu Đại lý (-22%), slide-over cart drawer, xóa emoji | M3 | survey |
| 16 | Home & About B2B Polish | Hero section sắc sảo, nổi bật chính sách sỉ B2B và sản phẩm thú cưng, Lucide SVGs | M3 | survey |
| 17 | Catalog & Product Detail B2B | Bộ lọc danh mục, trạng thái `status=published`, hiển thị giá sỉ & giá niêm yết rõ ràng | M3 | survey |
| 18 | B2B Quick Order SKU Matrix | `dat-hang-nhanh.astro` hỗ trợ Enter/Tab/mũi tên, tồn kho thực tế, tính tổng tiền tự động | M3 | survey |
| 19 | Cart & Checkout Redesign | Sticky Floating Pill discount bar, One-Step Checkout gọi `/api/products/calculate-price` sửa lệch giá | M3 | survey |
| 20 | Order Completion & Sales Summary | Gọi `/api/customers/sales-summary` sửa lỗi cộng dồn đơn hủy, sửa typo bậc chiết khấu | M3 | survey |
| 21 | Dealer Account Portal | Lịch sử đơn hàng, tiến độ giao hàng, trạng thái thanh toán và tích lũy doanh số năm/quý | M3 | survey |
| 22 | Admin Layout & Dashboard Redesign | Collapsible sidebar (`w-64` <-> `w-20`), Lucide SVGs, thẻ KPI chuẩn, Top 5 SKU và biểu đồ doanh số | M4 | survey |
| 23 | Admin Order Management ERP | Data Table có lọc trạng thái, tìm kiếm nhanh, nút Xuất Excel UTF-8 BOM, In phiếu A4 kèm VietQR Napas247 | M4 | survey |
| 24 | Admin Inventory Operations | Theo dõi tồn thực tế/giữ chỗ/khả dụng, cảnh báo tồn tối thiểu, modal nhập kho, Xuất Excel tồn kho | M4 | survey |
| 25 | Admin Dealer Operations | Danh sách đại lý, tích lũy doanh số, nút "1-Click Duyệt & Kích Hoạt" cấp mã `DL-...` và gửi email | M4 | survey |
| 26 | Admin Products & System Settings | Quản lý giá niêm yết/giá sỉ/SKU, cài đặt Thông tin Công ty, Cấu hình VietQR và Cấu hình SMTP | M4 | survey |
| 27 | E2E Testing Suite Tiers 1-4 | Bộ test tự động kiểm thử toàn bộ tính năng và bảo toàn nghiệp vụ (TEST_READY.md) | E2E | survey |
| 28 | Final Verification & Hardening | Pass 100% E2E, Tier 5 hardening, Audit CLEAN, npm run build exit 0 | Final | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Đội 1: Database & Migration | Docker stack, Clean PostgreSQL 16 schema, XML-RPC migration script, sequence reset | none | DONE |
| M2 | Đội 2: Backend Core & Security | Remove router/supabase, PostgreSQL transactions for 5 core services, purge JSON files, patch 7 security flaws | M1 | DONE |
| M3 | Đội 3: Storefront Modern B2B UI/UX | Clean Precision B2B Storefront: Header, Home, Catalog, Quick Order, Cart/Checkout price fixes, Account | M1, M2 | DONE |
| M4 | Đội 4: Admin Portal & ERP Operations | Clean Precision B2B Admin: Collapsible sidebar, Dashboard, Orders (Excel + A4 VietQR), Inventory, Dealers (1-Click), Settings | M1, M2 | DONE |
| E2E | E2E Testing Track | Test suite derived from requirements: Tiers 1-4, runner, TEST_READY.md | none (parallel) | DONE |
| Final | Final Verification & Audit | Pass 100% E2E tests, Tier 5 hardening, Forensic Auditor CLEAN, npm run build exit 0 | M1-M4, E2E | DONE |

## Interface Contracts
### Database Schema Contract (`src/lib/db.ts`)
- Connection pool pointing to `postgresql://crmuser:zalocrm_secure_password@127.0.0.1:5434/zalocrm` (or `.env` DB credentials).
- Exported query helpers: `query(text, params)`, `getClient()`, `withTransaction(async (client) => { ... })`.

### Pricing & Checkout Contract
- `POST /api/products/calculate-price` -> `{ success: true, items: Array<{ id: number, unit_price: number, discount_amount: number, total: number }>, summary: { subtotal: number, discount_total: number, total: number } }`
- `POST /api/orders/create-quotation` -> `{ success: true, order_id: number, order_code: string, amount_total: number }`
- `GET /api/customers/sales-summary?customer_id=...` -> `{ success: true, total_sales: number, order_count: number, current_tier: string }`

### Design System Contract
- Palette: `brand-dark` (#083a3c), `brand-primary` (#087b80), `brand-accent` (#23c1c6), `brand-surface` (#FAF8F5), `brand-sand` (#F5F1EB), `brand-gold` (#E5A93C), `brand-amber` (#F39C12), `brand-border` (#E2DCD5), `brand-text` (#1A202C), `brand-muted` (#718096).
- Strict Lucide SVGs, no oversized emojis, clean B2B styling.

## Code Layout
- `docker-compose.yml`, `Dockerfile`, `.dockerignore` — Independent container stack
- `scripts/migrate-from-odoo.mjs` — Odoo XML-RPC data migration
- `src/lib/db.ts` — PostgreSQL connection pool, Clean Schema DDL, transaction helper
- `src/services/`
  - `customer.service.ts` — Customer & dealer management via PostgreSQL
  - `product.service.ts` — Catalog & wholesale pricing via PostgreSQL
  - `order.service.ts` — Atomic order creation transaction
  - `inventory-storage.service.ts` — Atomic inventory reservation & receipt transaction
  - `promotionContextService.ts` — Tiered discount engine
  - `vnpay.service.ts` — Secure VNPay reconciliation
- `src/pages/`
  - Storefront: `index.astro`, `ve-lapet.astro`, `san-pham/`, `dat-hang-nhanh.astro`, `gio-hang.astro`, `thanh-toan.astro`, `hoan-tat.astro`, `tai-khoan/`
  - Admin: `admin/index.astro`, `admin/don-hang/`, `admin/kho/`, `admin/khach-hang/`, `admin/dang-ky-dai-ly/`, `admin/san-pham/`, `admin/cai-dat/`
- `email-otp-service/` — Hardened OTP microservice

## Testing & Operational Safety Constraints
- **Test Email Addresses Only**: When running any tests or operations that dispatch emails (OTP, notifications, dealer activation), ONLY use test email addresses matching `pminhphathi` or `phathideptrai2k5` (e.g. `pminhphathi@gmail.com`, `phathideptrai2k5@gmail.com`). NEVER dispatch emails to real customer/partner addresses!
- **Database Scope Isolation**: ONLY create, modify, or delete orders, customers, and inventory records on the local standalone PostgreSQL DB (`127.0.0.1:5434/zalocrm`). NEVER write, mutate, or alter data on live production Odoo ERP!
