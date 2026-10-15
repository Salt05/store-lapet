# Script deploy code len may chu SSH 192.168.1.112
param(
    [string]$ServerIP = "192.168.1.112",
    [string]$User = "root",
    [string]$RouterHost = ""
)

if (-not $RouterHost) {
    try {
        $foundIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.1.*" -and $_.InterfaceAlias -notlike "*vEthernet*" }).IPAddress | Select-Object -First 1
        if ($foundIP) { $RouterHost = $foundIP } else { $RouterHost = "192.168.1.12" }
    } catch {
        $RouterHost = "192.168.1.12"
    }
}

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "BAT DAU DEPLOY CODE LEN: $ServerIP (PORT 4321)" -ForegroundColor Cyan
Write-Host "Router Host (May Windows): http://${RouterHost}:3001" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Build du an moi nhat
Write-Host "`n[1/4] Dang build ma nguon (npm run build)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build that bai! Huy bo deploy." -ForegroundColor Red
    exit 1
}

# 2. Dong goi ma nguon va ban build dist
Write-Host "`n[2/4] Dang dong goi du an vao deploy.tar.gz..." -ForegroundColor Yellow
tar --exclude="node_modules" --exclude=".astro" -czvf deploy.tar.gz .

# 3. Upload file sang server
Write-Host "`n[3/4] Dang upload ma nguon sang server qua SCP..." -ForegroundColor Yellow
scp deploy.tar.gz server-setup.sh "${User}@${ServerIP}:/root/"

# 4. Kich hoat cai dat va khoi chay tren server
Write-Host "`n[4/4] Dang kich hoat setup tren server qua SSH..." -ForegroundColor Yellow
ssh "${User}@${ServerIP}" "sed -i 's/\r$//' /root/server-setup.sh && chmod +x /root/server-setup.sh && /root/server-setup.sh $RouterHost"

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host "HOAN TAT! Hay mo trinh duyet va kiem tra:" -ForegroundColor Green
Write-Host "1. Website:       http://${ServerIP}:4321" -ForegroundColor Green
Write-Host "2. Health Router: http://${ServerIP}:4321/api/router/health" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
