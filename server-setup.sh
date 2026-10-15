#!/bin/bash
set -e

echo "================================================="
echo "=== [1/5] Kiểm tra Node.js                    ==="
echo "================================================="
NEED_NODE=false
if ! command -v node &> /dev/null; then
    NEED_NODE=true
else
    NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 22 ]; then
        NEED_NODE=true
    fi
fi

if [ "$NEED_NODE" = true ]; then
    echo "Đang cài đặt Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs || yum install -y nodejs || true
fi

echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

echo "================================================="
echo "=== [2/5] Cài đặt PM2 quản lý tiến trình       ==="
echo "================================================="
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

echo "================================================="
echo "=== [3/5] Giải nén mã nguồn vào /var/www/store-lapet"
echo "================================================="
APP_DIR="/var/www/store-lapet"
mkdir -p "$APP_DIR"
tar -xzf /root/deploy.tar.gz -C "$APP_DIR"

# Đồng bộ sang /root/store-lapet để cả 2 thư mục luôn có code mới nhất
mkdir -p /root/store-lapet
tar -xzf /root/deploy.tar.gz -C /root/store-lapet

cd "$APP_DIR"

echo "================================================="
echo "=== [4/5] Cài đặt dependencies production     ==="
echo "================================================="
npm install --omit=dev

echo "================================================="
echo "=== [5/5] Mở cổng 4321 & Khởi chạy ứng dụng   ==="
echo "================================================="
if command -v ufw &> /dev/null; then
    ufw allow 4321/tcp || true
fi

ROUTER_HOST="${1:-192.168.1.12}"
echo "Đang cấu hình Router URL tới: http://${ROUTER_HOST}:3001"

if [ -f "$APP_DIR/.env" ]; then
    sed -i "s|ROUTER_API_URL=.*|ROUTER_API_URL=http://${ROUTER_HOST}:3001|g" "$APP_DIR/.env"
else
    echo "ROUTER_API_URL=http://${ROUTER_HOST}:3001" >> "$APP_DIR/.env"
fi

pm2 delete store-lapet 2>/dev/null || true
ROUTER_API_URL="http://${ROUTER_HOST}:3001" HOST=0.0.0.0 PORT=4321 pm2 start ./dist/server/entry.mjs --name "store-lapet" --node-args="--env-file=.env"
pm2 save

echo ""
echo "================================================="
echo "✅ TRIỂN KHAI THÀNH CÔNG!"
echo "🌐 Truy cập website:  http://192.168.1.112:4321"
echo "🔗 Health Router:     http://192.168.1.112:4321/api/router/health"
echo "📊 Trạng thái PM2:    pm2 status"
echo "📜 Xem log website:   pm2 logs store-lapet"
echo "================================================="
