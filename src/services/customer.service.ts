// src/services/customer.service.ts
import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface CustomerPartner {
  id: number;
  name: string;
  ref: string;
  code?: string;
  phone: string;
  email: string;
  tier?: string;
  cumulative_sales?: number;
  active: boolean;
  is_active: boolean;
  pricelist?: string;
  pricelist_id?: null | number;
  credit?: number;
  credit_available?: number;
  shipping_address?: string;
  delivery_addresses?: Array<{
    id: number;
    name: string;
    street: string;
    phone: string;
    is_default?: boolean;
  }>;
  password_hash?: string | null;
  has_password?: boolean;
  _isFallback?: boolean;
}

function getPhoneVariants(phone: string): string[] {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return [phone];
  const variants = [cleaned];
  if (cleaned.startsWith('0')) {
    variants.push('84' + cleaned.slice(1));
    variants.push('+84' + cleaned.slice(1));
  } else if (cleaned.startsWith('84')) {
    variants.push('0' + cleaned.slice(2));
    variants.push('+' + cleaned);
  }
  return variants;
}

export const customerService = {
  /**
   * Tra cứu đại lý theo số điện thoại (Phục vụ cho luồng Đăng nhập OTP)
   * Tìm kiếm linh hoạt trên cả trường phone và mobile trong PostgreSQL
   */
  async findPartnerByPhone(phone: string): Promise<CustomerPartner | null> {
    try {
      const variants = getPhoneVariants(phone);
      const res = await query(
        `SELECT id, code, name, email, phone, address, city, 
                tier, cumulative_sales, is_active, password_hash 
         FROM customers 
         WHERE phone = ANY($1)
         LIMIT 1`,
        [variants]
      );

      if (!res || res.rows.length === 0) {
        return null;
      }

      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name || '',
        ref: row.code || `DL-${row.id}`,
        code: row.code || `DL-${row.id}`,
        phone: row.phone || '',
        email: row.email || '',
        tier: row.tier || 'STANDARD',
        cumulative_sales: Number(row.cumulative_sales || 0),
        active: Boolean(row.is_active),
        is_active: Boolean(row.is_active),
        password_hash: row.password_hash || null,
        has_password: Boolean(row.password_hash),
      };
    } catch (error) {
      console.error('[CustomerService] Lỗi findPartnerByPhone:', error);
      return null;
    }
  },

  /**
   * Tra cứu đại lý theo SĐT hoặc Email trong PostgreSQL
   */
  async findPartnerByPhoneOrEmail(identifier: string): Promise<CustomerPartner | null> {
    try {
      const cleanIdentifier = identifier.trim();
      const variants = getPhoneVariants(cleanIdentifier);
      const cleanEmail = cleanIdentifier.toLowerCase();

      const res = await query(
        `SELECT id, code, name, email, phone, address, city, 
                tier, cumulative_sales, is_active, password_hash 
         FROM customers 
         WHERE (phone = ANY($1) OR LOWER(email) = $2)
         LIMIT 1`,
        [variants, cleanEmail]
      );

      if (!res || res.rows.length === 0) {
        return null;
      }

      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name || '',
        ref: row.code || `DL-${row.id}`,
        code: row.code || `DL-${row.id}`,
        phone: row.phone || '',
        email: row.email || '',
        tier: row.tier || 'STANDARD',
        cumulative_sales: Number(row.cumulative_sales || 0),
        active: Boolean(row.is_active),
        is_active: Boolean(row.is_active),
        password_hash: row.password_hash || null,
        has_password: Boolean(row.password_hash),
      };
    } catch (error) {
      console.error('[CustomerService] Lỗi findPartnerByPhoneOrEmail:', error);
      return null;
    }
  },

  /**
   * Lấy thông tin chi tiết đại lý theo ID kèm sổ địa chỉ giao hàng
   */
  async getPartnerById(partnerId: number): Promise<CustomerPartner> {
    try {
      const res = await query(
        `SELECT id, code, name, email, phone, address, city, 
                tier, cumulative_sales, is_active, password_hash 
         FROM customers 
         WHERE id = $1`,
        [partnerId]
      );

      if (!res || res.rows.length === 0) {
        return this.getFallbackPartner(partnerId);
      }

      const partner = res.rows[0];

      // Lấy danh sách địa chỉ giao hàng phụ từ customer_addresses
      let shippingAddresses: Array<{ id: number; name: string; street: string; phone: string; is_default?: boolean }> = [];
      try {
        const addrRes = await query(
          `SELECT id, customer_id, contact_name, phone, address, city, type, is_default 
           FROM customer_addresses 
           WHERE customer_id = $1 
           ORDER BY is_default DESC, id ASC`,
          [partnerId]
        );

        shippingAddresses = addrRes.rows.map((a) => ({
          id: a.id,
          name: a.contact_name || 'Địa chỉ giao hàng',
          street: a.address || '',
          phone: a.phone || partner.phone || '',
          is_default: Boolean(a.is_default),
        }));
      } catch (addrErr) {
        console.warn('[CustomerService] Không thể tải customer_addresses:', addrErr);
      }

      return {
        id: partner.id,
        name: partner.name || '',
        ref: partner.code || `DL-${partner.id}`,
        code: partner.code || `DL-${partner.id}`,
        phone: partner.phone || '',
        email: partner.email || '',
        tier: partner.tier || 'STANDARD',
        cumulative_sales: Number(partner.cumulative_sales || 0),
        active: Boolean(partner.is_active),
        is_active: Boolean(partner.is_active),
        password_hash: partner.password_hash || null,
        has_password: Boolean(partner.password_hash),
        pricelist: 'Bảng giá Đại lý',
        pricelist_id: null,
        credit: 0,
        credit_available: 0,
        shipping_address: partner.address || '',
        delivery_addresses: shippingAddresses,
      };
    } catch (error: any) {
      console.error(`⚠️ [CustomerService] Lỗi getPartnerById (${partnerId}):`, error?.message || error);
      return this.getFallbackPartner(partnerId);
    }
  },

  /**
   * Tạo khách hàng / đại lý mới trong PostgreSQL
   */
  async createCustomer(data: {
    code?: string;
    name: string;
    email?: string;
    phone: string;
    address?: string;
    tier?: string;
  }) {
    const code = data.code || `DL-${Date.now().toString().slice(-6)}`;
    const res = await query(
      `INSERT INTO customers (code, name, email, phone, address, tier, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (phone) DO UPDATE SET 
         name = EXCLUDED.name, 
         email = COALESCE(EXCLUDED.email, customers.email), 
         updated_at = NOW()
       RETURNING id, code, name, email, phone`,
      [code, data.name, data.email || null, data.phone, data.address || '', data.tier || 'STANDARD']
    );
    return res.rows[0];
  },

  /**
   * Thêm địa chỉ giao hàng mới cho đại lý
   */
  async createCustomerAddress(customerId: number, addressData: {
    contact_name?: string;
    phone?: string;
    address: string;
    is_default?: boolean;
  }) {
    const res = await query(
      `INSERT INTO customer_addresses (customer_id, contact_name, phone, address, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, customer_id, contact_name, address, is_default`,
      [
        customerId,
        addressData.contact_name || 'Địa chỉ giao hàng',
        addressData.phone || '',
        addressData.address,
        Boolean(addressData.is_default),
      ]
    );
    return res.rows[0];
  },

  /**
   * Cập nhật mật khẩu băm cho khách hàng / đại lý
   */
  async updatePassword(customerId: number, passwordHash: string): Promise<boolean> {
    try {
      const res = await query(
        `UPDATE customers SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, customerId]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error('[CustomerService] Lỗi updatePassword:', err);
      return false;
    }
  },

  /**
   * Cập nhật doanh số tích lũy cho đại lý (hỗ trợ truyền client của transaction)
   */
  async updateCumulativeSales(customerId: number, additionalSales: number, client?: PoolClient) {
    const sql = `
      UPDATE customers 
      SET cumulative_sales = cumulative_sales + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, cumulative_sales, tier
    `;
    const params = [additionalSales, customerId];
    if (client) {
      return await client.query(sql, params);
    }
    return await query(sql, params);
  },

  /**
   * Thống kê doanh số tích lũy & số đơn hàng cho đại lý
   */
  async getSalesSummary(partnerId: number) {
    const customerRes = await query(
      `SELECT id, tier, cumulative_sales FROM customers WHERE id = $1`,
      [partnerId]
    );
    if (!customerRes || customerRes.rows.length === 0) {
      return { success: false, error: 'Đại lý không tồn tại' };
    }
    const customer = customerRes.rows[0];
    const orderRes = await query(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(amount_total), 0) as total_sales 
       FROM orders 
       WHERE customer_id = $1 AND status != 'cancel'`,
      [partnerId]
    );
    const totalSales = Number(customer.cumulative_sales || orderRes.rows[0].total_sales || 0);
    const orderCount = Number(orderRes.rows[0].order_count || 0);
    return {
      success: true,
      total_sales: totalSales,
      order_count: orderCount,
      current_tier: customer.tier || 'STANDARD',
    };
  },

  /**
   * Dữ liệu đại lý dự phòng khi có lỗi truy vấn cơ sở dữ liệu
   */
  getFallbackPartner(partnerId: number): CustomerPartner {
    return {
      id: partnerId,
      name: 'Đại lý LA PET',
      ref: `DL-${partnerId}`,
      code: `DL-${partnerId}`,
      phone: '0900000000',
      email: 'daily@lapet.vn',
      tier: 'STANDARD',
      cumulative_sales: 0,
      active: true,
      is_active: true,
      pricelist: 'Bảng giá Đại lý',
      pricelist_id: null,
      credit: 0,
      credit_available: 0,
      shipping_address: 'Địa chỉ mặc định',
      delivery_addresses: [],
      _isFallback: true,
    };
  },
};