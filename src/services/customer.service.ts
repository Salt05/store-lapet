import { odooClient } from '@/lib/odoo';

export const customerService = {
  /**
   * Tra cứu liên hệ theo số điện thoại (Phục vụ cho luồng Đăng nhập OTP)
   * Tìm kiếm linh hoạt trên cả trường Điện thoại (phone) và Di động (mobile)
   */
  async findPartnerByPhone(phone: string) {
    try {
      const cleaned = phone.replace(/\D/g, '');
      
      // Tạo các biến thể định dạng SĐT phổ biến (0909xxx, 84909xxx, +84909xxx)
      const variants = [cleaned];
      if (cleaned.startsWith('0')) {
        variants.push('84' + cleaned.slice(1));
        variants.push('+84' + cleaned.slice(1));
      } else if (cleaned.startsWith('84')) {
        variants.push('0' + cleaned.slice(2));
        variants.push('+' + cleaned);
      }

      // Xây dựng danh sách điều kiện tìm kiếm cho phone và mobile
      const domainConditions: any[] = [];
      variants.forEach((v) => {
        domainConditions.push(['phone', 'ilike', v]);
        domainConditions.push(['mobile', 'ilike', v]);
      });

      // Tạo cấu trúc toán tử OR ('|') chuẩn trong Odoo Domain
      const finalDomain: any[] = [];
      for (let i = 0; i < domainConditions.length - 1; i++) {
        finalDomain.push('|');
      }
      finalDomain.push(...domainConditions);

      const partners = await odooClient.executeKw(
        'res.partner',
        'search_read',
        [finalDomain],
        {
          fields: ['id', 'name', 'phone', 'mobile', 'email', 'ref', 'active'],
          limit: 1,
        }
      );

      if (!partners || partners.length === 0) {
        return null;
      }

      return partners[0];
    } catch (error) {
      console.error('[CustomerService] Lỗi findPartnerByPhone:', error);
      return null;
    }
  },

  /**
   * Tra cứu liên hệ theo SĐT hoặc Email
   */
  async findPartnerByPhoneOrEmail(identifier: string) {
    try {
      const domain = [
        '|',
        '|',
        ['phone', 'ilike', identifier],
        ['mobile', 'ilike', identifier],
        ['email', '=', identifier],
      ];

      const partners = await odooClient.executeKw(
        'res.partner',
        'search_read',
        [domain],
        {
          fields: ['id', 'name', 'phone', 'mobile', 'email', 'ref', 'active'],
          limit: 1,
        }
      );

      if (!partners || partners.length === 0) {
        return null;
      }

      return partners[0];
    } catch (error) {
      console.error('[CustomerService] Lỗi findPartnerByPhoneOrEmail:', error);
      return null;
    }
  },

  /**
   * Lấy thông tin chi tiết liên hệ theo ID (Có bọc Fallback chống crash lỗi 500)
   */
  async getPartnerById(partnerId: number) {
    try {
      const result = await odooClient.executeKw(
        'res.partner',
        'read',
        [[partnerId]],
        {
          fields: [
            'id',
            'name',
            'ref',
            'phone',
            'mobile',
            'email',
            'street',
            'child_ids',
            'active',
          ],
        }
      );

      if (!result || result.length === 0) {
        return this.getFallbackPartner(partnerId);
      }

      const partner = result[0];

      // Safe fetch Địa chỉ giao hàng phụ (child_ids)
      let shippingAddresses: any[] = [];
      if (Array.isArray(partner.child_ids) && partner.child_ids.length > 0) {
        try {
          const rawChildren = await odooClient.executeKw(
            'res.partner',
            'read',
            [partner.child_ids],
            { fields: ['id', 'name', 'type', 'street', 'phone', 'mobile'] }
          );

          if (Array.isArray(rawChildren)) {
            shippingAddresses = rawChildren
              .filter((a: any) => a && (a.type === 'delivery' || a.type === 'other'))
              .map((a: any) => ({
                id: a.id,
                name: a.name || 'Địa chỉ phụ',
                street: a.street || '',
                phone: a.phone || a.mobile || '',
              }));
          }
        } catch (childErr) {
          console.warn('[CustomerService] Không thể lấy danh sách child_ids:', childErr);
          shippingAddresses = [];
        }
      }

      return {
        id: partner.id,
        name: partner.name || '',
        ref: partner.ref || '',
        phone: partner.phone || partner.mobile || '',
        email: partner.email || '',
        active: partner.active ?? true,
        pricelist: 'Bảng giá Đại lý',
        pricelist_id: null,
        credit: 0,
        credit_available: 0,
        shipping_address: partner.street || '',
        delivery_addresses: shippingAddresses,
      };
    } catch (error: any) {
      console.error(`⚠️ [CustomerService] Lỗi getPartnerById (${partnerId}):`, error?.message || error);
      return this.getFallbackPartner(partnerId);
    }
  },

  /**
   * Dữ liệu đại lý dự phòng khi Odoo API lỗi quyền truy cập
   */
  getFallbackPartner(partnerId: number) {
    return {
      id: partnerId,
      name: 'Đại lý (Hệ thống đang xác thực Odoo)',
      ref: `DL-${partnerId}`,
      phone: '0900000000',
      email: 'daily@lapet.vn',
      active: true,
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