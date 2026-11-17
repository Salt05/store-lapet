<#
.SYNOPSIS
    Kịch bản khởi chạy đồng thời toàn bộ hệ thống LA PET:
    - Backend Directus CMS (Port 8055) kèm quản lý Uploads/Hình ảnh
    - Cổng dịch vụ xác thực OTP SĐT / Email (Port 4000) & Redis (Port 6379)
    - Frontend Astro SSR Storefront & Quản trị Admin (Port 4321)
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "STORE LA PET - FULL SYSTEM RUNNER"

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "         🚀 KHỞI ĐỘNG HỆ THỐNG LA PET (FULLSTACK + DỊCH VỤ)          " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

# 1. Khởi động Docker Containers (Backend CMS & OTP Microservice & Images Volume & Hệ sinh thái OCMS)
Write-Host "[1/3] Đang khởi chạy Docker Containers (Directus, OTP, Redis, PostgreSQL DB, OCMS Router)..." -ForegroundColor Yellow
try {
    docker compose up -d
    docker start database redis router app 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  -> Toàn bộ Docker containers đang chạy ổn định." -ForegroundColor Green
    } else {
        Write-Host "  -> [LƯU Ý] Không chạy được một số container. Vui lòng kiểm tra Docker Desktop!" -ForegroundColor Red
    }
} catch {
    Write-Host "  -> Không tìm thấy lệnh docker. Bỏ qua bước Docker." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "[2/3] Kiểm tra dependencies Frontend & OTP Service..." -ForegroundColor Yellow

# Kiểm tra node_modules của root
if (-not (Test-Path "$RootPath\node_modules")) {
    Write-Host "  -> Đang cài đặt thư viện cho Frontend..." -ForegroundColor Gray
    npm install
}

# 3. Khởi chạy Dịch vụ OTP bằng cửa sổ nền độc lập (dành cho môi trường dev trực tiếp không qua Docker)
$otpPath = Join-Path $RootPath "email-otp-service"
if (Test-Path $otpPath) {
    Write-Host "  -> Đang bật Dịch vụ Xác thực OTP (Port 4000) trong tiến trình riêng..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$otpPath'; Write-Host '--- OTP SERVICE RUNNING ON PORT 4000 ---' -ForegroundColor Magenta; npm run dev" -WindowStyle Minimized
}

# 4. Chạy Frontend Astro Storefront & Admin
Write-Host ""
Write-Host "[3/3] Khởi chạy Frontend Astro (Storefront & Admin Dashboard)..." -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " 🌐 Storefront Web:       http://localhost:4321" -ForegroundColor White
Write-Host " ⚙️  Admin Dashboard:     http://localhost:4321/admin" -ForegroundColor White
Write-Host " 📦 Backend Directus:     http://localhost:8055" -ForegroundColor White
Write-Host " 🔐 Cổng OTP (SĐT/Mail):  http://localhost:4000" -ForegroundColor White
Write-Host " 🚀 OCMS Universal Router:http://localhost:3001" -ForegroundColor White
Write-Host " 🗄️  PostgreSQL Database:  localhost:5433" -ForegroundColor White
Write-Host " 🖼️  Directus Media/Img:   http://localhost:8055/assets" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Ấn Ctrl + C để dừng Astro." -ForegroundColor Gray
Write-Host ""

npm run dev

