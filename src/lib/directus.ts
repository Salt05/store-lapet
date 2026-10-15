import { createDirectus, rest } from '@directus/sdk';

const directusUrl = import.meta.env.DIRECTUS_URL;

if (!directusUrl) {
  throw new Error('[Directus] DIRECTUS_URL chưa được cấu hình');
}

export const directus = createDirectus(directusUrl).with(rest());