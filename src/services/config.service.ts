// src/services/config.service.ts
import { directus, directusAdmin } from '../lib/directus.ts';
import { readItems, updateItem, createItem } from '@directus/sdk';
import { DISCOUNT_CONFIG, type CategoryPolicy } from '../config/discounts.ts';
import { LONGTERM_POLICY, type LongtermPolicyConfig } from '../config/longterm-policy.ts';
import { PROMOTIONS, type Promotion } from '../config/promotion.ts';
import { getPgPool } from '../lib/db.ts';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60s in-memory cache for ultra-fast performance
let configsCache: CacheEntry<Map<string, any>> | null = null;
let policiesCache: CacheEntry<CategoryPolicy[]> | null = null;
let promotionsCache: CacheEntry<Promotion[]> | null = null;

export const configService = {
  invalidateCache() {
    configsCache = null;
    policiesCache = null;
    promotionsCache = null;
  },

  /**
   * Lấy chiết khấu cơ bản (Đọc ưu tiên từ PostgreSQL: promotion_policies -> app_settings -> system_configs -> fallback 22%)
   */
  async getBaseDiscountPercent(): Promise<number> {
    try {
      const pool = getPgPool();
      // 1. Thử lấy từ promotion_policies (type = BASIC_DISCOUNT)
      const res = await pool.query(
        "SELECT actions FROM promotion_policies WHERE type = 'BASIC_DISCOUNT' AND is_active = true LIMIT 1;"
      );
      if (res.rows.length > 0 && res.rows[0].actions?.discountPercent !== undefined) {
        return Number(res.rows[0].actions.discountPercent);
      }

      // 2. Thử lấy từ app_settings
      const appSetRes = await pool.query(
        "SELECT value_plain FROM app_settings WHERE setting_key = 'base_discount_percent' LIMIT 1;"
      );
      if (appSetRes.rows.length > 0 && appSetRes.rows[0].value_plain) {
        return Number(appSetRes.rows[0].value_plain);
      }
    } catch (dbErr) {
      console.warn('[configService] Không thể đọc base discount từ PG:', (dbErr as any)?.message);
    }

    try {
      const configs = await this.getAllConfigs();
      const val = configs.get('base_discount_percent');
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && !isNaN(Number(val))) return Number(val);
      return DISCOUNT_CONFIG.baseDiscountPercent || 22;
    } catch {
      return DISCOUNT_CONFIG.baseDiscountPercent || 22;
    }
  },

  /**
   * Lấy chính sách doanh số tích lũy dài hạn từ PostgreSQL (promotion_policies: SALES_REWARD_QUARTER & SALES_REWARD_YEAR)
   */
  async getLongtermPolicy(): Promise<LongtermPolicyConfig> {
    try {
      const pool = getPgPool();
      const res = await pool.query(
        "SELECT code, type, actions FROM promotion_policies WHERE type IN ('SALES_REWARD_QUARTER', 'SALES_REWARD_YEAR') AND is_active = true;"
      );

      if (res.rows.length > 0) {
        const qRow = res.rows.find((r) => r.type === 'SALES_REWARD_QUARTER');
        const yRow = res.rows.find((r) => r.type === 'SALES_REWARD_YEAR');

        const formatLabel = (target: number) => {
          if (target >= 1_000_000_000) return `${target / 1_000_000_000}Tỷ`;
          return `${target / 1_000_000}Tr`;
        };

        const quarterMilestones = (qRow?.actions?.rewardTiers || LONGTERM_POLICY.quarterMilestones).map(
          (t: any) => ({
            target: Number(t.minAmount || t.target),
            label: t.label || formatLabel(Number(t.minAmount || t.target)),
            rate: Number(t.rewardPercent || t.rate),
          })
        );

        const yearMilestones = (yRow?.actions?.rewardTiers || LONGTERM_POLICY.yearMilestones).map(
          (t: any) => ({
            target: Number(t.minAmount || t.target),
            label: t.label || formatLabel(Number(t.minAmount || t.target)),
            rate: Number(t.rewardPercent || t.rate),
          })
        );

        return {
          year: new Date().getFullYear(),
          quarterMilestones,
          yearMilestones,
        };
      }
    } catch (pgErr) {
      console.warn('[configService] Không thể đọc longterm_policy từ PG:', (pgErr as any)?.message);
    }

    try {
      const configs = await this.getAllConfigs();
      const val = configs.get('longterm_policy');
      if (val && typeof val === 'object') return val as LongtermPolicyConfig;
      return LONGTERM_POLICY;
    } catch {
      return LONGTERM_POLICY;
    }
  },

  /**
   * Lấy danh sách chính sách chiết khấu bậc thang theo danh mục từ PostgreSQL
   */
  /**
   * Chính sách bậc thang theo danh mục đã được gỡ bỏ khỏi hệ thống
   */
  async getCategoryPolicies(): Promise<CategoryPolicy[]> {
    return [];
  },

  /**
   * Chương trình khuyến mãi ngắn hạn đã được gỡ bỏ khỏi hệ thống
   */
  async getActivePromotions(_date = new Date()): Promise<Promotion[]> {
    return [];
  },

  filterPromotionsByDate(list: Promotion[], date: Date): Promotion[] {
    const time = date.getTime();
    return list
      .filter((p) => {
        if (!p.active) return false;
        if (p.startDate && time < new Date(`${p.startDate}T00:00:00`).getTime()) return false;
        if (p.endDate && time > new Date(`${p.endDate}T23:59:59`).getTime()) return false;
        return true;
      })
      .sort((a, b) => a.priority - b.priority);
  },

  /**
   * Đọc tất cả cấu hình từ PostgreSQL app_settings
   */
  async getAllConfigs(): Promise<Map<string, any>> {
    const now = Date.now();
    if (configsCache && configsCache.expiresAt > now) {
      return configsCache.data;
    }

    const map = new Map<string, any>();

    // 1. Đọc từ PostgreSQL app_settings
    try {
      const pool = getPgPool();
      const res = await pool.query('SELECT key, setting_key, value_json, value_plain FROM app_settings;');
      for (const row of res.rows) {
        const itemKey = row.key || row.setting_key;
        if (itemKey) {
          let val = row.value_json;
          if (!val || (typeof val === 'object' && Object.keys(val).length === 0 && row.value_plain)) {
            try {
              val = JSON.parse(row.value_plain);
            } catch {
              val = row.value_plain;
            }
          }
          map.set(itemKey, val);
        }
      }
    } catch (pgErr) {
      console.warn('[configService] Lỗi đọc app_settings từ PG:', (pgErr as any)?.message);
    }

    configsCache = { data: map, expiresAt: now + CACHE_TTL_MS };
    return map;
  },

  /**
   * Cập nhật config theo key trong PostgreSQL app_settings
   */
  async saveConfig(key: string, value: any, description?: string) {
    this.invalidateCache();

    // 1. Lưu vào PostgreSQL app_settings
    try {
      const pool = getPgPool();
      const valJson = typeof value === 'object' && value !== null ? JSON.stringify(value) : null;
      const valPlain = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);

      await pool.query(
        `INSERT INTO app_settings (key, setting_key, value_json, value_plain, description, updated_at)
         VALUES ($1, $1, COALESCE($2::jsonb, '{}'::jsonb), $3, $4, NOW())
         ON CONFLICT (key) 
         DO UPDATE SET 
           setting_key = EXCLUDED.setting_key,
           value_json = EXCLUDED.value_json, 
           value_plain = EXCLUDED.value_plain,
           description = COALESCE(EXCLUDED.description, app_settings.description),
           updated_at = NOW();`,
        [key, valJson, valPlain, description || '']
      );

      // Kích hoạt reload cho email-otp-service nếu là cấu hình email / smtp
      if (key === 'smtp_config' || key === 'notification_config') {
        try {
          const emailOtpUrl = process.env.EMAIL_OTP_SERVICE_URL || 'http://127.0.0.1:4000';
          fetch(`${emailOtpUrl.replace(/\/+$/, '')}/api/reload-config`, { method: 'POST' }).catch(() => {});
        } catch {}
      }
    } catch (pgErr) {
      console.warn('[configService] Không thể ghi app_settings PG:', (pgErr as any)?.message);
    }
  },

  /**
   * Lấy cấu hình kết nối hệ thống (Đọc ưu tiên từ PostgreSQL app_settings và fallback)
   */
  async getIntegrationsConfig() {
    let directusFromDb: any = {};

    try {
      const pool = getPgPool();
      const res = await pool.query(
        "SELECT setting_key, value_plain FROM app_settings WHERE setting_key IN ('directus_url', 'directus_email', 'integrations');"
      );

      const dbMap = new Map<string, string>();
      for (const row of res.rows) {
        dbMap.set(row.setting_key, row.value_plain);
      }

      if (dbMap.has('integrations')) {
        try {
          const parsed = JSON.parse(dbMap.get('integrations') || '{}');
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch {}
      }

      directusFromDb = {
        url: dbMap.get('directus_url'),
      };
    } catch (pgErr) {
      console.warn('[configService] Lỗi đọc integrations từ app_settings PG:', (pgErr as any)?.message);
    }

    const defaultIntegrations = {
      directus: {
        url: directusFromDb.url || process.env.DIRECTUS_URL || 'http://127.0.0.1:8055',
        adminToken: process.env.DIRECTUS_ADMIN_TOKEN || 'lapet_admin_dev_token_2026',
      },
      router: {
        url: process.env.ROUTER_API_URL || 'http://127.0.0.1:3001',
      },
      emailOtp: {
        url: process.env.EMAIL_OTP_SERVICE_URL || 'http://localhost:4000',
      },
      ocmsBackend: {
        url: process.env.OCMS_BACKEND_URL || 'http://localhost:3080',
      },
    };

    try {
      const configs = await this.getAllConfigs();
      const saved = configs.get('integrations');
      if (saved && typeof saved === 'object') {
        return {
          directus: { ...defaultIntegrations.directus, ...(saved.directus || {}) },
          router: { ...defaultIntegrations.router, ...(saved.router || {}) },
          emailOtp: { ...defaultIntegrations.emailOtp, ...(saved.emailOtp || {}) },
          ocmsBackend: { ...defaultIntegrations.ocmsBackend, ...(saved.ocmsBackend || {}) },
        };
      }
    } catch {
      // Fallback
    }

    return defaultIntegrations;
  },

  /**
   * Lưu cấu hình kết nối hệ thống và cập nhật biến môi trường runtime
   */
  async saveIntegrationsConfig(newConfig: any) {
    await this.saveConfig('integrations', newConfig, 'Cấu hình kết nối Directus, Email OTP và các dịch vụ');

    // Cập nhật runtime env variables cho Router và Email OTP
    if (newConfig.router?.url) {
      process.env.ROUTER_API_URL = newConfig.router.url;
    }
    if (newConfig.emailOtp?.url) {
      process.env.EMAIL_OTP_SERVICE_URL = newConfig.emailOtp.url;
    }
    if (newConfig.ocmsBackend?.url) {
      process.env.OCMS_BACKEND_URL = newConfig.ocmsBackend.url;
    }
  },

  /**
   * Kiểm tra kết nối tới Directus
   */
  async testDirectusConnection(directusConfig: { url: string; adminToken: string }) {
    try {
      const cleanUrl = directusConfig.url.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/users/me`, {
        headers: { Authorization: `Bearer ${directusConfig.adminToken}` },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const json = await res.json();
        return { success: true, user: json.data?.email || 'Admin Token hợp lệ' };
      } else {
        return { success: false, error: `Directus phản hồi mã lỗi HTTP ${res.status}: ${res.statusText}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Không thể kết nối máy chủ Directus' };
    }
  },

  /**
   * Kiểm tra kết nối Router
   */
  async testRouterConnection(routerUrl: string) {
    try {
      let cleanUrl = (routerUrl || 'http://127.0.0.1:3001').replace(/\/+$/, '');
      if (cleanUrl.startsWith('http://localhost:')) {
        cleanUrl = cleanUrl.replace('http://localhost:', 'http://127.0.0.1:');
      }
      const res = await fetch(`${cleanUrl}/health`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        return { success: true };
      }
      // Fallback
      const fb = await fetch(`${cleanUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (fb.ok) {
        return { success: true };
      }
      return { success: false, error: `Router phản hồi HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Router không phản hồi' };
    }
  },

  /**
   * Kiểm tra kết nối Email OTP Service
   */
  async testEmailOtpConnection(emailOtpUrl: string) {
    try {
      const cleanUrl = (emailOtpUrl || 'http://localhost:4000').replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: `Email OTP phản hồi HTTP ${res.status}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Email OTP không phản hồi (fetch failed)' };
    }
  },
};
