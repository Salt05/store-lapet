@echo off
setlocal
cd /d "%~dp0"
title LA PET STORE - LOCAL DEV SERVER

echo ===================================================
echo [1/3] Kiem tra & khoi dong Docker Containers (Directus, OTP, Redis)...
echo ===================================================
docker compose up -d

echo.
echo ===================================================
echo [2/3] Khoi dong He sinh thai Backend (Database Postgres, OCMS Router, OCMS Backend)...
echo ===================================================
docker start database redis router app 2>nul
if %ERRORLEVEL% equ 0 (
    echo   - Database (PostgreSQL 5433):  [OK]
    echo   - Redis Queue (Port 6379):     [OK]
    echo   - OCMS Router (Port 3001):     [OK]
    echo   - OCMS Backend (Port 3080):    [OK]
) else (
    echo   - Da gui tin hieu khoi dong cac container phu tro.
)

echo.
echo ===================================================
echo [3/3] Khoi dong Frontend Astro...
echo ---------------------------------------------------
echo Website Storefront:    http://localhost:4321
echo Admin Dashboard:       http://localhost:4321/admin
echo Directus CMS:          http://localhost:8055
echo Dich vu OTP:           http://localhost:4000
echo OCMS Universal Router: http://localhost:3001
echo Health Router:         http://localhost:4321/api/router/health
echo PostgreSQL Database:   localhost:5433 (zalocrm)
echo OCMS Backend:          http://localhost:3080
echo ===================================================
echo.

call npm run dev
pause
