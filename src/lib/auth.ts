import type { APIContext } from 'astro';

export interface AuthState {
  isAuthenticated: boolean;
  isDealer: boolean;
  partnerId: number | null;
  partnerName: string | null;
  partnerPhone: string | null;
}

const guestAuthState: AuthState = {
  isAuthenticated: false,
  isDealer: false,
  partnerId: null,
  partnerName: null,
  partnerPhone: null,
};

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

    // 2. Dự phòng đọc từ Browser Cookies nếu đã đăng nhập qua cookies
    if (!partnerId && context.cookies) {
      const cookieVal = context.cookies.get('partner_id')?.value;
      if (cookieVal && /^\d+$/.test(cookieVal)) {
        partnerId = Number(cookieVal);
      }
      if (!partnerName) {
        partnerName = context.cookies.get('partner_name')?.value || null;
      }
      if (!partnerPhone) {
        partnerPhone = context.cookies.get('partner_phone')?.value || null;
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