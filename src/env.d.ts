/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    auth: {
      isAuthenticated: boolean;
      isDealer: boolean;
      partnerId: number | null;
      partnerName: string | null;
      partnerPhone: string | null;
    };
  }
}

interface ImportMetaEnv {
  readonly ODOO_URL: string;
  readonly ODOO_DB: string;
  readonly ODOO_USER: string;
  readonly ODOO_API_KEY: string;

  readonly ODOO_READER_URL?: string;
  readonly ODOO_READER_DB?: string;
  readonly ODOO_READER_USER?: string;
  readonly ODOO_READER_API_KEY?: string;

  readonly ODOO_WRITER_URL?: string;
  readonly ODOO_WRITER_DB?: string;
  readonly ODOO_WRITER_USER?: string;
  readonly ODOO_WRITER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}