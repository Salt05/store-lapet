const Redis = require('ioredis');
const config = require('./config');

class MemoryStore {
  constructor() {
    this.storage = new Map();
    this.timers = new Map();
  }

  async set(key, value, ttlSeconds) {
    // Clear timer cũ nếu có
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    this.storage.set(key, JSON.stringify(value));

    if (ttlSeconds && ttlSeconds > 0) {
      const timer = setTimeout(() => {
        this.storage.delete(key);
        this.timers.delete(key);
      }, ttlSeconds * 1000);

      this.timers.set(key, timer);
    }
    return true;
  }

  async get(key) {
    const raw = this.storage.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async del(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.storage.delete(key);
  }
}

class StoreManager {
  constructor() {
    this.redisClient = null;
    this.memoryStore = new MemoryStore();
    this.usingRedis = false;

    this.initRedis();
  }

  initRedis() {
    try {
      const client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        retryStrategy: (times) => {
          if (times > 2) {
            // Ngưng retry sau 2 lần nếu không có Redis để chuyển sang In-Memory
            return null;
          }
          return 500;
        },
        connectTimeout: 2000,
        lazyConnect: true,
      });

      client
        .connect()
        .then(() => {
          this.redisClient = client;
          this.usingRedis = true;
          console.log(`[Store] ✅ Kết nối thành công tới Redis (${config.redis.host}:${config.redis.port})`);
        })
        .catch(() => {
          this.usingRedis = false;
          console.log(
            '[Store] ℹ️  Không thể kết nối Redis -> Tự động kích hoạt In-Memory (RAM Store) để lưu trữ OTP.',
          );
        });

      client.on('error', () => {
        this.usingRedis = false;
      });
    } catch (e) {
      this.usingRedis = false;
      console.log('[Store] ℹ️  Đang sử dụng bộ nhớ RAM (In-Memory).');
    }
  }

  async set(key, value, ttlSeconds) {
    if (this.usingRedis && this.redisClient) {
      try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds && ttlSeconds > 0) {
          await this.redisClient.setex(key, ttlSeconds, serialized);
        } else {
          await this.redisClient.set(key, serialized);
        }
        return true;
      } catch (err) {
        console.warn('[Store] Lỗi khi ghi Redis, chuyển sang lưu tạm RAM:', err.message);
      }
    }
    return this.memoryStore.set(key, value, ttlSeconds);
  }

  async get(key) {
    if (this.usingRedis && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      } catch (err) {
        console.warn('[Store] Lỗi khi đọc Redis, chuyển sang đọc RAM:', err.message);
      }
    }
    return this.memoryStore.get(key);
  }

  async del(key) {
    if (this.usingRedis && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return true;
      } catch (err) {
        console.warn('[Store] Lỗi khi xóa Redis, chuyển sang xóa RAM:', err.message);
      }
    }
    return this.memoryStore.del(key);
  }

  isUsingRedis() {
    return this.usingRedis;
  }
}

module.exports = new StoreManager();
