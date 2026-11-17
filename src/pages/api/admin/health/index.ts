// src/pages/api/admin/health/index.ts
import type { APIRoute } from 'astro';
import { query } from '@/lib/db';
import { configService } from '@/services/config.service';

export const prerender = false;

interface ServiceHealthResult {
  status: 'healthy' | 'down';
  latencyMs: number;
  details?: string;
  error?: string;
}

/**
 * 1. Kiểm tra sức khỏe PostgreSQL Database
 */
async function checkPostgres(): Promise<ServiceHealthResult> {
  const start = Date.now();
  try {
    const res = await query(`SELECT current_database() AS db_name, version() AS pg_ver`);
    const latencyMs = Date.now() - start;
    const dbName = res.rows[0]?.db_name || 'zalocrm';
    return {
      status: 'healthy',
      latencyMs,
      details: `DB: ${dbName} (Sẵn sàng)`,
    };
  } catch (err: any) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err?.message || 'Không thể kết nối cơ sở dữ liệu PostgreSQL',
    };
  }
}

/**
 * 2. Kiểm tra sức khỏe Directus Headless CMS qua REST API
 */
async function checkDirectus(directusConfig: any): Promise<ServiceHealthResult> {
  const start = Date.now();
  const cleanUrl = (directusConfig?.url || process.env.DIRECTUS_URL || 'http://127.0.0.1:8055').replace(/\/+$/, '');
  const adminToken = directusConfig?.adminToken || process.env.DIRECTUS_ADMIN_TOKEN || 'lapet_admin_dev_token_2026';

  try {
    // Thử endpoint /server/health trước
    const healthRes = await fetch(`${cleanUrl}/server/health`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: AbortSignal.timeout(4000),
    });

    const latencyMs = Date.now() - start;
    if (healthRes.ok) {
      const data = await healthRes.json().catch(() => ({}));
      return {
        status: 'healthy',
        latencyMs,
        details: data?.releaseId ? `Directus v${data.releaseId}` : 'Sẵn sàng',
      };
    }

    // Fallback: Kiểm tra /users/me với Admin Static Token
    const userRes = await fetch(`${cleanUrl}/users/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      signal: AbortSignal.timeout(3000),
    });

    const userLatency = Date.now() - start;
    if (userRes.ok) {
      const userData = await userRes.json().catch(() => ({}));
      return {
        status: 'healthy',
        latencyMs: userLatency,
        details: userData?.data?.email || 'Admin Token hợp lệ',
      };
    }

    return {
      status: 'down',
      latencyMs,
      error: `Directus phản hồi HTTP ${healthRes.status}: ${healthRes.statusText}`,
    };
  } catch (err: any) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err.message || 'Không thể kết nối máy chủ Directus',
    };
  }
}

/**
 * 4. Kiểm tra sức khỏe Email OTP Service (timeout 3s)
 */
async function checkEmailOtp(emailOtpConfig: any): Promise<ServiceHealthResult> {
  const start = Date.now();
  const cleanUrl = (emailOtpConfig?.url || process.env.EMAIL_OTP_SERVICE_URL || 'http://localhost:4000').replace(/\/+$/, '');

  try {
    const res = await fetch(`${cleanUrl}/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        status: 'healthy',
        latencyMs,
        details: 'Dịch vụ Email OTP sẵn sàng',
      };
    }

    return {
      status: 'down',
      latencyMs,
      error: `Email OTP phản hồi HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      status: 'down',
      latencyMs: Date.now() - start,
      error: err.message || 'Không thể kết nối Email OTP Service',
    };
  }
}

export const GET: APIRoute = async () => {
  try {
    const integrations = await configService.getIntegrationsConfig();

    const [postgres, directus, emailOtp] = await Promise.all([
      checkPostgres(),
      checkDirectus(integrations.directus),
      checkEmailOtp(integrations.emailOtp),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        services: {
          postgres,
          directus,
          emailOtp,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: err.message || 'Lỗi xử lý kiểm tra sức khỏe hệ thống',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
