// Script tự động kiểm tra toàn bộ luồng của email-otp-service
const http = require('http');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode, body: resData });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let resData = '';
      res.on('data', (chunk) => (resData += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('🧪 Bắt đầu kiểm tra kiểm thử tự động dịch vụ OTP...');

  // 1. Kiểm tra /health
  const health = await get('http://localhost:4000/health');
  console.log('1. Health check status:', health.status, health.body);

  // 2. Kiểm tra gửi OTP
  const testEmail = 'tester@example.com';
  const sendRes = await post('http://localhost:4000/api/send-otp', { email: testEmail });
  console.log('2. Send OTP status:', sendRes.status, sendRes.body);

  // 3. Thử gửi lại ngay lập tức (Kỳ vọng bị 429 Cooldown)
  const spamRes = await post('http://localhost:4000/api/send-otp', { email: testEmail });
  console.log('3. Rate limit check (Kỳ vọng 429):', spamRes.status, spamRes.body?.message);

  // 4. Thử xác thực mã sai (Kỳ vọng 400 và giảm số lần thử)
  const wrongRes = await post('http://localhost:4000/api/verify-otp', { email: testEmail, otp: '000000' });
  console.log('4. Wrong OTP check (Kỳ vọng 400):', wrongRes.status, wrongRes.body?.message);

  console.log('✅ Hoàn thành tất cả các bước kiểm thử!');
  process.exit(0);
}

// Chờ server chạy rồi test
setTimeout(runTest, 1500);
