import type { APIContext } from 'astro';
import crypto from 'node:crypto';

export interface AuthState {
  isAuthenticated: boolean;
  isDealer: boolean;
  partnerId: number | null;
  partnerName: string | null;
  partnerPhone: string | null;
}

export interface AdminAuthState {
  isAdmin: boolean;
  adminId: string | null;
  adminEmail: string | null;
  adminName: string | null;
  role: string | null;
}

export const AUTH_COOKIE_NAME = 'la_pet_auth_token';
export const ADMIN_COOKIE_NAME = 'la_pet_admin_token';

const guestAdminAuthState: AdminAuthState = {
  isAdmin: false,
  adminId: null,
  adminEmail: null,
  adminName: null,
  role: null,
};

const guestAuthState: AuthState = {
  isAuthenticated: false,
  isDealer: false,
  partnerId: null,
  partnerName: null,
  partnerPhone: null,
};

function getAuthSecret(): string {
  return (
    (typeof process !== 'undefined' && process.env?.AUTH_SECRET) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.AUTH_SECRET) ||
    'la-pet-store-secure-hmac-salt-secret-key-2026'
  );
}

/**
 * Tạo token xác thực có chữ ký số HMAC-SHA256 chống giả mạo
 */
export function createAuthToken(payload: {
  partnerId: number;
  partnerName?: string | null;
  partnerPhone?: string | null;
  ttlSeconds?: number;
}): string {
  const secret = getAuthSecret();
  const ttl = payload.ttlSeconds || 7 * 24 * 60 * 60; // Mặc định 7 ngày
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const data = {
    pid: payload.partnerId,
    pname: payload.partnerName || null,
    pphone: payload.partnerPhone || null,
    exp: expiresAt,
  };

  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedData).digest('base64url');
  return `${encodedData}.${signature}`;
}

/**
 * Xác thực và giải mã token có chữ ký số HMAC-SHA256
 */
export function verifyAuthToken(token: string): {
  partnerId: number;
  partnerName: string | null;
  partnerPhone: string | null;
} | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedData, signature] = parts;
  const secret = getAuthSecret();
  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedData).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const raw = Buffer.from(encodedData, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    if (!parsed.exp || parsed.exp < now) {
      return null;
    }

    const partnerId = Number(parsed.pid);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return null;
    }

    return {
      partnerId,
      partnerName: parsed.pname || null,
      partnerPhone: parsed.pphone || null,
    };
  } catch {
    return null;
  }
}

export async function getAuthState(
  context: Pick<APIContext, 'session'> & { cookies?: any }
): Promise<AuthState> {
  try {
    let partnerId: number | null = null;
    let partnerName: string | null = null;
    let partnerPhone: string | null = null;

    // 1. Kiểm tra Astro session
    if (context.session) {
      partnerId = (await context.session.get<number>('partner_id')) ?? null;
      partnerName = (await context.session.get<string>('partner_name')) ?? null;
      partnerPhone = (await context.session.get<string>('partner_phone')) ?? null;
    }

    // 2. Kiểm tra Cookie có chữ ký số HMAC (Chỉ tin tưởng token hợp lệ, TUYỆT ĐỐI không đọc cookie thô)
    if (!partnerId && context.cookies) {
      const authToken = context.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (authToken) {
        const verified = verifyAuthToken(authToken);
        if (verified) {
          partnerId = verified.partnerId;
          partnerName = verified.partnerName;
          partnerPhone = verified.partnerPhone;
        }
      }
    }

    if (!partnerId || !Number.isInteger(partnerId) || partnerId <= 0) {
      return guestAuthState;
    }

    return {
      isAuthenticated: true,
      isDealer: true,
      partnerId,
      partnerName,
      partnerPhone,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[AUTH] Failed to read session:', error);
    }

    return guestAuthState;
  }
}

/**
 * Tạo token Admin HMAC-SHA256
 */
export function createAdminToken(payload: {
  adminId: string;
  adminEmail: string;
  adminName?: string | null;
  role?: string;
  ttlSeconds?: number;
}): string {
  const secret = getAuthSecret();
  const ttl = payload.ttlSeconds || 24 * 60 * 60; // 24 giờ
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;

  const data = {
    aid: payload.adminId,
    email: payload.adminEmail,
    name: payload.adminName || 'Admin',
    role: payload.role || 'admin',
    exp: expiresAt,
  };

  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedData).digest('base64url');
  return `${encodedData}.${signature}`;
}

/**
 * Xác thực và giải mã token Admin
 */
export function verifyAdminToken(token: string): {
  adminId: string;
  adminEmail: string;
  adminName: string;
  role: string;
} | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedData, signature] = parts;
  const secret = getAuthSecret();
  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedData).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const raw = Buffer.from(encodedData, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    if (!parsed.exp || parsed.exp < now) return null;
    if (!parsed.aid || !parsed.email) return null;

    return {
      adminId: String(parsed.aid),
      adminEmail: String(parsed.email),
      adminName: parsed.name || 'Admin',
      role: parsed.role || 'admin',
    };
  } catch {
    return null;
  }
}

export async function getAdminAuthState(
  context: { cookies?: any }
): Promise<AdminAuthState> {
  try {
    if (!context.cookies) return guestAdminAuthState;
    const cookie = context.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!cookie) return guestAdminAuthState;

    const verified = verifyAdminToken(cookie);
    if (!verified) return guestAdminAuthState;

    return {
      isAdmin: true,
      adminId: verified.adminId,
      adminEmail: verified.adminEmail,
      adminName: verified.adminName,
      role: verified.role,
    };
  } catch {
    return guestAdminAuthState;
  }
}

/**
 * Băm mật khẩu sử dụng crypto.scryptSync với salt ngẫu nhiên
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Xác thực mật khẩu với hash đã lưu
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  try {
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return keyBuffer.length === derivedKey.length && crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

