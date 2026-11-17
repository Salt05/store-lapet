/**
 * Directus Headless CMS Type Definitions for LA PET B2B
 *
 * Covers Marketing, Dealer Registrations,
 * Catalog, Branches, and Articles collections.
 */

export interface MarketingBanner {
  id: number;
  title: string;
  image_url?: string | null;
  link_url: string;
  position: string;
  badge?: string | null;
  subtitle?: string | null;
  cta_text?: string | null;
  status: 'active' | 'inactive' | 'draft' | 'archived' | string;
  display_order: number;
  date_created?: string;
}

export interface DealerRegistration {
  id: number;
  name: string;
  full_name?: string | null;
  phone: string;
  store_name?: string | null;
  business_model: string;
  city?: string | null;
  city_province?: string | null;
  email?: string | null;
  note?: string | null;
  notes?: string | null;
  status: 'pending' | 'contacted' | 'approved' | 'rejected' | string;
  date_created?: string;
  created_at?: string | null;
}

export interface DirectusCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface DirectusProductGroup {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface DirectusProduct {
  id: number;
  name: string;
  slug: string;
  odoo_id?: number | null;
  sku?: string | null;
  price: number;
  wholesale_price?: number | null;
  weight?: string | null;
  specification?: string | null;
  ingredients?: string | null;
  description?: string | null;
  target?: string | null;
  preservation?: string | null;
  sold_quantity?: number | null;
  status?: string | null;
  category?: number | null;
  group?: number | null;
  nutritional_info?: string | null;
  sort?: number | null;
}

export interface DirectusBranch {
  id: number;
  name: string;
  slug: string;
  city_province?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  working_hours?: string | null;
  google_map_embed?: string | null;
  is_headquarter?: boolean | null;
  sort_order?: number | null;
  status?: string | null;
}

export interface DirectusArticleCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

export interface DirectusArticle {
  id: number;
  title: string;
  slug: string;
  summary?: string | null;
  content_html?: string | null;
  category_id?: number | null;
  published_at?: string | null;
  views_count?: number | null;
  status?: string | null;
}

export interface DirectusSystemConfig {
  id: number;
  key: string;
  value: any;
  description?: string | null;
}

export interface DirectusPromotion {
  id: number;
  promo_id: string;
  name: string;
  type: string;
  active: boolean;
  stackable: boolean;
  priority: number;
  application_mode: string;
  description?: string | null;
  customer_note?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  condition?: any;
  reward?: any;
}

export interface DirectusDiscountCategoryPolicy {
  id: number;
  category_id: string;
  category_name: string;
  active: boolean;
  tiers?: any;
}

export interface DirectusSchema {
  marketing_banners: MarketingBanner[];
  dealer_registrations: DealerRegistration[];
  categories: DirectusCategory[];
  product_groups: DirectusProductGroup[];
  products: DirectusProduct[];
  branches: DirectusBranch[];
  article_categories: DirectusArticleCategory[];
  articles: DirectusArticle[];
  system_configs: DirectusSystemConfig[];
  promotions: DirectusPromotion[];
  discount_category_policies: DirectusDiscountCategoryPolicy[];
}
