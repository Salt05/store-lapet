import { createDirectus, rest, staticToken } from '@directus/sdk';
import type { DirectusSchema } from '@/types/directus';

const directusUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.DIRECTUS_URL) ||
  (typeof process !== 'undefined' ? process.env?.DIRECTUS_URL : undefined) ||
  'http://127.0.0.1:8055';

const directusAdminToken =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.DIRECTUS_ADMIN_TOKEN) ||
  (typeof process !== 'undefined' ? process.env?.DIRECTUS_ADMIN_TOKEN : undefined) ||
  'lapet_admin_dev_token_2026';

if (!directusUrl) {
  throw new Error('[Directus] DIRECTUS_URL chưa được cấu hình');
}

/**
 * Public Directus client (for public queries adhering to Public role permissions)
 */
export const directus = createDirectus<DirectusSchema>(directusUrl).with(rest());

/**
 * Directus Admin client (for privileged server-side operations with static token)
 */
export const directusAdmin = createDirectus<DirectusSchema>(directusUrl)
  .with(rest())
  .with(staticToken(directusAdminToken));