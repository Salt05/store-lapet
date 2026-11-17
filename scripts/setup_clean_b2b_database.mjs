import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://crmuser:zalocrm_secure_password@127.0.0.1:5433/zalocrm',
});

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function setup() {
  console.log('--- 1. TẠO BẢNG CUSTOMERS & CUSTOMER_ADDRESSES ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50) UNIQUE,
      password_hash VARCHAR(255),
      address TEXT,
      city VARCHAR(100),
      tier VARCHAR(50) DEFAULT 'STANDARD',
      cumulative_sales NUMERIC(15, 2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
    CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);

    CREATE TABLE IF NOT EXISTS customer_addresses (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      contact_name VARCHAR(255),
      phone VARCHAR(50),
      address TEXT NOT NULL,
      city VARCHAR(100),
      type VARCHAR(50) DEFAULT 'delivery',
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON customer_addresses(customer_id);
  `);

  console.log('--- 2. TẠO BẢNG PRODUCTS & ĐỒNG BỘ TỪ PRODUCT_CACHE ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE,
      price NUMERIC(15, 2) NOT NULL DEFAULT 0,
      wholesale_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
      unit VARCHAR(50) DEFAULT 'Cái',
      weight NUMERIC(10, 2) DEFAULT 0,
      category VARCHAR(100),
      image_url TEXT,
      status VARCHAR(50) DEFAULT 'published',
      is_active BOOLEAN DEFAULT TRUE,
      sold_quantity INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  `);

  const prodCount = await pool.query('SELECT COUNT(*) as c FROM products');
  if (parseInt(prodCount.rows[0].c, 10) === 0) {
    const cacheRes = await pool.query(`
      SELECT sku, name, list_price, wholesale_price, retail_price, uom_name, weight, category, image_url, is_active, sold_quantity
      FROM product_cache
      WHERE sku IS NOT NULL AND TRIM(sku) != ''
      ORDER BY created_at ASC
    `);
    const usedSlugs = new Set();
    let inserted = 0;
    for (const row of cacheRes.rows) {
      const sku = row.sku.trim();
      let baseSlug = slugify(row.name || sku) || slugify(sku);
      let slug = baseSlug;
      if (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${slugify(sku)}-${inserted}`;
      }
      usedSlugs.add(slug);

      const price = Number(row.list_price || row.retail_price || row.wholesale_price || 0);
      const wholesale = Number(row.wholesale_price || row.list_price || 0);
      const numWeight = row.weight && !isNaN(Number(row.weight)) ? Number(row.weight) : 0;

      await pool.query(
        `INSERT INTO products (sku, name, slug, price, wholesale_price, unit, weight, category, image_url, status, is_active, sold_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', $10, $11)
         ON CONFLICT (sku) DO NOTHING`,
        [
          sku,
          row.name || sku,
          slug,
          price,
          wholesale,
          row.uom_name || 'Đơn vị',
          numWeight,
          row.category || null,
          row.image_url || null,
          row.is_active !== false,
          Math.round(Number(row.sold_quantity || 0)),
        ]
      );
      inserted++;
    }
    console.log(`✓ Đã đồng bộ ${inserted} sản phẩm từ product_cache sang products`);
  }

  console.log('--- 3. CHUẨN HÓA INVENTORY_ITEMS, INVENTORY_RECEIPTS, INVENTORY_TRANSACTIONS ---');
  await pool.query(`
    ALTER TABLE inventory_items ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE inventory_items ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE inventory_items ALTER COLUMN org_id SET DEFAULT 'f4a9d7b5-0181-47cf-948d-5af48a77236e';
    ALTER TABLE inventory_items ALTER COLUMN updated_at SET DEFAULT NOW();
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL;

    -- Liên kết product_id theo SKU
    UPDATE inventory_items i
    SET product_id = p.id
    FROM products p
    WHERE UPPER(TRIM(i.sku)) = UPPER(TRIM(p.sku)) AND i.product_id IS NULL;

    -- Thêm cột available dạng STORED nếu chưa có
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'available'
      ) THEN
        ALTER TABLE inventory_items ADD COLUMN available DOUBLE PRECISION GENERATED ALWAYS AS (on_hand - reserved) STORED;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS inventory_receipts (
      id SERIAL PRIMARY KEY,
      receipt_code VARCHAR(100) UNIQUE NOT NULL,
      supplier_name VARCHAR(255),
      deliver_to VARCHAR(255) DEFAULT 'Kho Tổng LA PET - TP.HCM',
      total_items INT DEFAULT 0,
      total_quantity NUMERIC(12, 2) DEFAULT 0,
      total_amount NUMERIC(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'completed',
      notes TEXT,
      created_by_name VARCHAR(100) DEFAULT 'Admin',
      receipt_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE inventory_transactions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE inventory_transactions ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE inventory_transactions ALTER COLUMN org_id SET DEFAULT 'f4a9d7b5-0181-47cf-948d-5af48a77236e';
    ALTER TABLE inventory_transactions ALTER COLUMN inventory_item_id DROP NOT NULL;
    ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS product_id INT;
    ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS receipt_id INT;
    ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS performed_by VARCHAR(100) DEFAULT 'System';
  `);

  console.log('--- 4. CHUẨN HÓA BẢNG ORDERS & ORDER_ITEMS ---');
  await pool.query(`
    ALTER TABLE orders ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE orders ALTER COLUMN org_id DROP NOT NULL;
    ALTER TABLE orders ALTER COLUMN org_id SET DEFAULT 'f4a9d7b5-0181-47cf-948d-5af48a77236e';
    ALTER TABLE orders ALTER COLUMN contact_id DROP NOT NULL;
    ALTER TABLE orders ALTER COLUMN created_by_user_id DROP NOT NULL;
    ALTER TABLE orders ALTER COLUMN total_amount DROP NOT NULL;
    ALTER TABLE orders ALTER COLUMN updated_at SET DEFAULT NOW();

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES customers(id) ON DELETE SET NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_name VARCHAR(255);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_phone VARCHAR(50);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_email VARCHAR(255);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'bank_transfer';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_untaxed NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_tax NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_discount NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_total NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_order_ref VARCHAR(100);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_order TIMESTAMPTZ DEFAULT NOW();

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id INT,
      sku VARCHAR(100),
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      price_unit NUMERIC(15, 2) NOT NULL DEFAULT 0,
      discount_percent NUMERIC(5, 2) DEFAULT 0,
      price_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('✓ Hoàn tất Giai đoạn 1: Toàn bộ Schema PostgreSQL đã chuẩn hóa!');
  await pool.end();
}

setup().catch(err => {
  console.error('Lỗi setup:', err);
  process.exit(1);
});
