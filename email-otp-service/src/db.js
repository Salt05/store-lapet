const { Pool } = require('pg');

let pool = null;

function getPgPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://crmuser:zalocrm_secure_password@127.0.0.1:5433/zalocrm';
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
    });

    pool.on('error', (err) => {
      console.error('[Email OTP Service - DB] Pool error:', err.message);
    });
  }
  return pool;
}

let settingsCache = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 giây cache

async function getSetting(key, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && settingsCache[key] && now - lastFetchTime < CACHE_TTL_MS) {
    return settingsCache[key];
  }

  try {
    const db = getPgPool();
    const res = await db.query(
      'SELECT key, value_json, value_plain FROM app_settings WHERE key = $1 LIMIT 1',
      [key]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    let parsedValue = row.value_json;
    if (typeof parsedValue === 'string') {
      try {
        parsedValue = JSON.parse(parsedValue);
      } catch {
        parsedValue = row.value_plain;
      }
    }

    settingsCache[key] = parsedValue;
    lastFetchTime = now;
    return parsedValue;
  } catch (err) {
    console.error(`[Email OTP Service - DB] Lỗi đọc setting '${key}':`, err.message);
    return settingsCache[key] || null;
  }
}

function clearSettingsCache() {
  settingsCache = {};
  lastFetchTime = 0;
}

module.exports = {
  getPgPool,
  getSetting,
  clearSettingsCache,
};

