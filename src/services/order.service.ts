// src/services/order.service.ts

import { odooClient } from '@/lib/odoo';
import { submitOrderToRouter } from './router-client';

import { PromotionContextService } from './promotionContextService';
import {
  PromotionEngine,
  normalizeSku,
  type CartItem,
} from './promotionEngine';

type QuotationItemInput = {
  id: number | string;
  sku: string;
  qty: number | string;
};

type CustomShippingAddressInput = {
  name?: string;
  phone?: string;
  street?: string;
};

type CreateQuotationParams = {
  partner_id: number;
  shipping_address_id?: number | string | null;
  is_custom_address?: boolean;
  custom_address?: CustomShippingAddressInput;
  note?: string;
  client_order_ref?: string;
  items: QuotationItemInput[];
};

type NormalizedItem = {
  product_id: number;
  sku: string;
  qty: number;
};

export class OrderValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'OrderValidationError';
    this.statusCode = statusCode;
  }
}

function toPositiveInteger(value: unknown, fieldName: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new OrderValidationError(`${fieldName} không hợp lệ`);
  }

  return numberValue;
}

function cleanText(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return '';

  return value.trim().slice(0, maxLength);
}

function getMany2OneId(value: unknown) {
  if (Array.isArray(value)) {
    return Number(value[0]);
  }

  return Number(value);
}

function normalizeClientOrderRef(value: unknown) {
  const cleaned = cleanText(value, 80);

  if (!cleaned) return undefined;

  return cleaned.replace(/[^\w.:/-]/g, '-');
}

function normalizeItems(items: QuotationItemInput[]): NormalizedItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError('Danh sách sản phẩm không hợp lệ');
  }

  const groupedItems = new Map<
    number,
    {
      sku: string;
      qty: number;
    }
  >();

  for (const item of items) {
    const productId = toPositiveInteger(item?.id, 'Mã sản phẩm');
    const qty = toPositiveInteger(item?.qty, 'Số lượng sản phẩm');
    const sku = normalizeSku(item?.sku);

    if (!sku) {
      throw new OrderValidationError(`Sản phẩm (ID: ${productId}) chưa truyền SKU`);
    }

    if (qty > 9999) {
      throw new OrderValidationError(
        'Số lượng sản phẩm vượt quá giới hạn cho phép'
      );
    }

    const existing = groupedItems.get(productId);

    if (existing && existing.sku !== sku) {
      throw new OrderValidationError(
        `Sản phẩm ID ${productId} bị xung đột SKU (${existing.sku} khác ${sku})`
      );
    }

    const newQty = (existing?.qty || 0) + qty;

    if (newQty > 9999) {
      throw new OrderValidationError(
        `Tổng số lượng sản phẩm ${productId} vượt quá giới hạn cho phép`
      );
    }

    groupedItems.set(productId, {
      sku,
      qty: newQty,
    });
  }

  return Array.from(groupedItems.entries()).map(([productId, data]) => ({
    product_id: productId,
    sku: data.sku,
    qty: data.qty,
  }));
}

function formatQuotation(order: any, alreadyExists = false) {
  return {
    success: true,
    already_exists: alreadyExists,
    order_id: order.id,
    order_name: order.name,
    state: order.state,
    amount_untaxed: order.amount_untaxed || 0,
    amount_total: order.amount_total || order.amount_untaxed || 0,
    client_order_ref: order.client_order_ref || '',
  };
}

export const orderService = {
  async createQuotation(params: CreateQuotationParams) {
    /*
     * =========================================================
     * 1. VALIDATE INPUT
     * =========================================================
     */

    const partnerId = toPositiveInteger(params.partner_id, 'Đại lý');
    const items = normalizeItems(params.items);
    const clientOrderRef = normalizeClientOrderRef(params.client_order_ref);

    /*
     * =========================================================
     * 2. IDEMPOTENCY
     * =========================================================
     */

    if (clientOrderRef) {
      const existingOrder = await this.findExistingQuotation(
        partnerId,
        clientOrderRef
      );

      if (existingOrder) {
        return formatQuotation(existingOrder, true);
      }
    }

    /*
     * =========================================================
     * 3. VALIDATE PARTNER & PRODUCTS
     * =========================================================
     */

    const partner = await this.getActivePartner(partnerId);
    const productById = await this.getSaleableProducts(items);

    /*
     * =========================================================
     * 4. RESOLVE SHIPPING ADDRESS
     * =========================================================
     */

    const shippingPartnerId = await this.resolveShippingPartner(
      partner,
      params
    );

    /*
     * =========================================================
     * 5. LẤY LỊCH SỬ PROMOTION
     * =========================================================
     */

    const customerContext = await PromotionContextService.getCustomerContext(
      String(partnerId)
    );

    /*
     * =========================================================
     * 6. BUILD CART (Dùng SKU từ Directus & Giá niêm yết từ Odoo)
     * =========================================================
     */

    const promotionCart: CartItem[] = items.map((item) => {
      const product = productById.get(item.product_id);

      if (!product) {
        throw new OrderValidationError(
          `Không tìm thấy thông tin sản phẩm ${item.product_id}`
        );
      }

      const originalPrice = Number(product.list_price ?? 0);

      if (!Number.isFinite(originalPrice) || originalPrice < 0) {
        throw new OrderValidationError(
          `Giá sản phẩm ${product.display_name || product.id} không hợp lệ`
        );
      }

      return {
        sku: item.sku,
        quantity: item.qty,
        originalPrice,
        unitPrice: originalPrice,
        categoryDiscountPercent: 0,
        itemDiscountPercent: 0,
        finalPrice: originalPrice,
        totalLineAmount: Math.round(originalPrice * item.qty),
      };
    });

    /*
     * =========================================================
     * 7. CHẠY PROMOTION ENGINE
     * =========================================================
     */

    const promotionResult = PromotionEngine.calculateCart(
      promotionCart,
      new Date(),
      customerContext
    );

    /*
     * =========================================================
     * 8. BUILD ODOO ORDER LINES
     * =========================================================
     */

    const orderLines = items.map((item, index) => {
      const product = productById.get(item.product_id);
      const productUomId = getMany2OneId(product?.uom_id);
      const calculatedItem = promotionResult.items[index];

      if (!calculatedItem) {
        throw new OrderValidationError(
          `Không thể tính giá sản phẩm ${item.product_id}`
        );
      }

      const priceUnit = calculatedItem.unitPrice;
      const categoryDiscount = calculatedItem.categoryDiscountPercent || 0;

      return [
        0,
        0,
        {
          product_id: item.product_id,
          product_uom_qty: item.qty,
          price_unit: priceUnit,
          ...(productUomId ? { product_uom: productUomId } : {}),
          ...(categoryDiscount > 0 ? { discount: categoryDiscount } : {}),
        },
      ];
    });

    /*
     * =========================================================
     * 9. BUILD PROMOTION METADATA & CREATE ORDER
     * =========================================================
     */

    const promotionMetadata = {
      source: 'website',
      promotions: promotionResult.proposedPromotions.categoryTierPromos.map(
        (promo) => ({
          promotionId: promo.promoId,
          categoryId: promo.categoryId,
          discountPercent: promo.appliedPercent,
        })
      ),
    };

    /*
     * =========================================================
     * 9. BUILD PAYLOAD & SUBMIT TO OCMS UNIVERSAL ROUTER
     * =========================================================
     */

    const orderCode = clientOrderRef || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const routerItems = items.map((item, index) => {
      const product = productById.get(item.product_id);
      const calculatedItem = promotionResult.items[index];
      return {
        sku: item.sku,
        product_name: product?.display_name || product?.name || item.sku,
        quantity: item.qty,
        price: calculatedItem?.unitPrice ?? Number(product?.list_price || 0),
      };
    });

    const rawPhone = String(partner.phone || partner.mobile || '0987654321').replace(/\D/g, '');
    const validPhone = rawPhone.length === 9 && !rawPhone.startsWith('0')
      ? '0' + rawPhone
      : rawPhone.length === 10
        ? rawPhone
        : rawPhone.length === 11 && rawPhone.startsWith('84')
          ? '0' + rawPhone.slice(2)
          : '0987654321';

    const routerPayload = {
      order_code: orderCode,
      source: 'store-lapet',
      partner_id: partnerId,
      customer_name: partner.name || 'Đại lý La Pet',
      customer_phone: validPhone,
      shipping_address: params.is_custom_address && params.custom_address?.street
        ? `${params.custom_address.street}${params.custom_address.name ? ' (Người nhận: ' + params.custom_address.name + ')' : ''}`
        : (partner.street || 'Địa chỉ đại lý La Pet, Việt Nam'),
      items: routerItems,
      total_amount: promotionResult.finalTotal,
      payment_method: 'cod',
      note: cleanText(params.note, 2000),
      metadata: {
        partner_id: partnerId,
        partner_invoice_id: partnerId,
        partner_shipping_id: params.is_custom_address ? undefined : shippingPartnerId,
        is_custom_address: Boolean(params.is_custom_address),
        custom_address: params.custom_address,
        promotion_metadata: promotionMetadata,
      },
    };

    // Gửi đơn hàng sang Router trung tâm (phản hồi siêu tốc trong < 25ms)
    const routerResult = await submitOrderToRouter(routerPayload);

    /*
     * =========================================================
     * 10. TRẢ VỀ KẾT QUẢ CHO GIAO DIỆN STORE
     * =========================================================
     */
    return {
      success: true,
      order_id: routerResult.order_code,
      id: routerResult.order_code,
      name: routerResult.order_code,
      order_code: routerResult.order_code,
      tracking_id: routerResult.tracking_id,
      state: routerResult.status || 'pending',
      amount_untaxed: promotionResult.subtotal - promotionResult.totalDiscount,
      amount_total: promotionResult.finalTotal,
      client_order_ref: orderCode,
      router_dispatched: routerResult.dispatched,
      execution_time_ms: routerResult.execution_time_ms,
      already_exists: false,
      promotion: {
        subtotal: promotionResult.subtotal,
        totalDiscount: promotionResult.totalDiscount,
        finalTotal: promotionResult.finalTotal,
        appliedPromotions: promotionResult.appliedPromotions,
        proposedPromotions: promotionResult.proposedPromotions,
      },
    };
  },

  async findExistingQuotation(partnerId: number, clientOrderRef: string) {
    const orders = await odooClient.executeKw(
      'sale.order',
      'search_read',
      [
        [
          ['partner_id', '=', partnerId],
          ['client_order_ref', '=', clientOrderRef],
          ['state', '!=', 'cancel'],
        ],
      ],
      {
        fields: [
          'id',
          'name',
          'state',
          'amount_untaxed',
          'amount_total',
          'client_order_ref',
        ],
        limit: 1,
        order: 'id desc',
      }
    );

    return Array.isArray(orders) && orders.length > 0 ? orders[0] : null;
  },

  async getActivePartner(partnerId: number) {
    const partners = await odooClient.executeKw(
      'res.partner',
      'read',
      [[partnerId]],
      {
        fields: ['id', 'name', 'active', 'child_ids'],
      }
    );

    if (!Array.isArray(partners) || partners.length === 0) {
      throw new OrderValidationError(
        'Đại lý không tồn tại trong Odoo',
        404
      );
    }

    const partner = partners[0];

    if (partner.active === false) {
      throw new OrderValidationError('Đại lý đang bị tạm khóa', 403);
    }

    return partner;
  },

  async getSaleableProducts(items: NormalizedItem[]) {
    const productIds = items.map((item) => item.product_id);

    const products = await odooClient.executeKw(
      'product.product',
      'read',
      [productIds],
      {
        fields: [
          'id',
          'display_name',
          'active',
          'sale_ok',
          'uom_id',
          'list_price',
        ],
      }
    );

    const productList = Array.isArray(products) ? products : [];
    const productById = new Map<number, any>();

    for (const product of productList) {
      productById.set(Number(product.id), product);
    }

    const missingProductId = productIds.find((id) => !productById.has(id));

    if (missingProductId) {
      throw new OrderValidationError(
        `Sản phẩm ${missingProductId} không tồn tại trong Odoo`,
        400
      );
    }

    const unavailableProduct = productList.find(
      (product: any) => product.active === false || product.sale_ok === false
    );

    if (unavailableProduct) {
      throw new OrderValidationError(
        `Sản phẩm ${unavailableProduct.display_name || unavailableProduct.id
        } chưa được phép bán`,
        400
      );
    }

    return productById;
  },

  async resolveShippingPartner(
    partner: any,
    params: CreateQuotationParams
  ) {
    if (params.is_custom_address) {
      // Địa chỉ giao hàng mới sẽ được chuyển giao qua Universal Router để xử lý đồng bộ
      return partner.id;
    }

    if (!params.shipping_address_id) {
      return partner.id;
    }

    const shippingId = toPositiveInteger(
      params.shipping_address_id,
      'Địa chỉ giao hàng'
    );

    if (shippingId === partner.id) {
      return partner.id;
    }

    const addresses = await odooClient.executeKw(
      'res.partner',
      'read',
      [[shippingId]],
      {
        fields: ['id', 'parent_id', 'active', 'type'],
      }
    );

    if (!Array.isArray(addresses) || addresses.length === 0) {
      throw new OrderValidationError(
        'Địa chỉ giao hàng không tồn tại trong Odoo',
        404
      );
    }

    const address = addresses[0];
    const parentId = getMany2OneId(address.parent_id);

    if (address.active === false || parentId !== partner.id) {
      throw new OrderValidationError(
        'Địa chỉ giao hàng không thuộc đại lý đang đăng nhập',
        403
      );
    }

    return address.id;
  },

  async createDeliveryAddress(
    partnerId: number,
    customAddress?: CustomShippingAddressInput
  ) {
    const name = cleanText(customAddress?.name, 120);
    const phone = cleanText(customAddress?.phone, 30);
    const street = cleanText(customAddress?.street, 255);

    if (!name || !phone || !street) {
      throw new OrderValidationError(
        'Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ giao hàng'
      );
    }

    const addressId = await odooClient.executeKw('res.partner', 'create', [
      {
        parent_id: partnerId,
        type: 'delivery',
        name,
        phone,
        street,
      },
    ]);

    return toPositiveInteger(addressId, 'Địa chỉ giao hàng mới');
  },

  async readQuotation(orderId: number) {
    const orders = await odooClient.executeKw(
      'sale.order',
      'read',
      [[orderId]],
      {
        fields: [
          'id',
          'name',
          'state',
          'amount_untaxed',
          'amount_total',
          'client_order_ref',
        ],
      }
    );

    if (!Array.isArray(orders) || orders.length === 0) {
      throw new Error('Không thể đọc lại báo giá vừa tạo trong Odoo');
    }

    return orders[0];
  },
};