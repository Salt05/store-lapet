// src/services/order.service.ts
import { query, withTransaction, generateNextOrderCode } from '@/lib/db';
import type { PoolClient } from 'pg';
import { PromotionContextService } from './promotionContextService';
import {
  PromotionEngine,
  normalizeSku,
  type CartItem,
} from './promotionEngine';
import { inventoryStorageService } from './inventory-storage.service';
import { ORDER_STATUS, PAYMENT_STATUS, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/config/order-constants';

export type QuotationItemInput = {
  id?: number | string;
  odoo_id?: number | string;
  sku?: string;
  qty?: number | string;
  quantity?: number | string;
};

export type CustomShippingAddressInput = {
  name?: string;
  phone?: string;
  street?: string;
};

export type CreateQuotationParams = {
  partner_id: number;
  payment_method?: string;
  shipping_address_id?: number | string | null;
  is_custom_address?: boolean;
  custom_address?: CustomShippingAddressInput;
  delivery_address?: string;
  note?: string;
  client_order_ref?: string;
  items: QuotationItemInput[];
};

export class OrderValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'OrderValidationError';
    this.statusCode = statusCode;
  }
}

function toPositiveInteger(value: unknown, fieldName: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new OrderValidationError(`${fieldName} không hợp lệ`);
  }
  return numberValue;
}

function cleanText(value: unknown, maxLength = 255): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeClientOrderRef(value: unknown): string | undefined {
  const cleaned = cleanText(value, 80);
  if (!cleaned) return undefined;
  return cleaned.replace(/[^\w.:/-]/g, '-');
}

export const orderService = {
  /**
   * Tạo đơn hàng / báo giá thương mại B2B trong PostgreSQL Transaction nguyên tử.
   * Sử dụng SELECT ... FOR UPDATE trên customers và inventory_items để chống Race Condition.
   */
  async createQuotation(params: CreateQuotationParams) {
    const partnerId = toPositiveInteger(params.partner_id, 'Mã Đại lý');
    const rawItems = params.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new OrderValidationError('Danh sách sản phẩm không hợp lệ', 400);
    }

    // 1. Chuẩn hóa & gom các item
    const parsedItems = rawItems.map((item: any) => {
      const rawId = item.id ?? item.odoo_id ?? item.product_id;
      const numId = rawId !== undefined && rawId !== null ? Number(rawId) : undefined;
      const sku = item.sku ? normalizeSku(item.sku) : '';
      const rawQty = item.qty ?? item.quantity;
      const numQty = typeof rawQty === 'number' ? Math.round(rawQty) : parseInt(String(rawQty), 10);

      if (!numQty || numQty <= 0) {
        throw new OrderValidationError('Số lượng sản phẩm phải lớn hơn 0', 400);
      }
      return { id: numId && numId > 0 ? numId : undefined, sku, qty: numQty };
    });

    // Gom số lượng trùng (ưu tiên gom theo SKU để tránh lệch ID với Directus)
    const mergedMap = new Map<string, { id?: number; sku?: string; qty: number }>();
    for (const it of parsedItems) {
      const key = it.sku ? `SKU_${it.sku}` : (it.id ? `ID_${it.id}` : '');
      if (!key) continue;
      const existing = mergedMap.get(key);
      if (existing) {
        existing.qty += it.qty;
      } else {
        mergedMap.set(key, { ...it });
      }
    }
    const mergedItems = Array.from(mergedMap.values());

    const clientOrderRef = normalizeClientOrderRef(params.client_order_ref);

    // 2. Thực thi toàn bộ quy trình đặt hàng trong PostgreSQL Transaction
    return await withTransaction(async (client: PoolClient) => {
      // 2.1. Khóa hàng khách hàng: SELECT ... FOR UPDATE
      const customerRes = await client.query(
        `SELECT id, code, name, email, phone, address, city, 
                tier, cumulative_sales, is_active 
         FROM customers 
         WHERE id = $1 
         FOR UPDATE`,
        [partnerId]
      );

      if (customerRes.rows.length === 0) {
        throw new OrderValidationError('Đại lý không tồn tại trong hệ thống', 404);
      }

      const customer = customerRes.rows[0];
      if (customer.is_active === false) {
        throw new OrderValidationError('Tài khoản đại lý đang bị tạm khóa', 403);
      }

      // 2.2. Kiểm tra Idempotency nếu có clientOrderRef
      if (clientOrderRef) {
        const existingRes = await client.query(
          `SELECT id, order_code, amount_total, status, payment_status, created_at 
           FROM orders 
           WHERE customer_id = $1 AND (client_order_ref = $2 OR order_code = $2) AND status NOT IN ('cancel', 'cancelled')
           LIMIT 1`,
          [partnerId, clientOrderRef]
        );

        if (existingRes.rows.length > 0) {
          const existing = existingRes.rows[0];
          return {
            success: true,
            id: existing.id,
            order_id: existing.id,
            order_code: existing.order_code,
            code: existing.order_code,
            name: existing.order_code,
            state: existing.status,
            amount_total: Number(existing.amount_total),
            total: Number(existing.amount_total),
            client_order_ref: clientOrderRef,
            already_exists: true,
          };
        }
      }

      // 2.3. Khóa tài nguyên tồn kho: SELECT ... FOR UPDATE trên inventory_items
      const itemIds = mergedItems.map((m) => m.id).filter((id): id is number => typeof id === 'number');
      const itemSkus = mergedItems.map((m) => m.sku).filter((sku): sku is string => typeof sku === 'string' && sku.length > 0);

      const invConditions: string[] = [];
      const invParams: any[] = [];
      if (itemIds.length > 0) {
        invParams.push(itemIds);
        invConditions.push(`product_id = ANY($${invParams.length})`);
      }
      if (itemSkus.length > 0) {
        invParams.push(itemSkus);
        invConditions.push(`UPPER(sku) = ANY($${invParams.length})`);
      }

      const invWhere = invConditions.length > 0 ? `WHERE ${invConditions.join(' OR ')}` : '';
      const invRes = await client.query(
        `SELECT id, product_id, sku, on_hand, reserved, 
                (on_hand - reserved) as available 
         FROM inventory_items 
         ${invWhere} 
         FOR UPDATE`,
        invParams
      );

      const invByProductId = new Map<number, any>();
      const invBySku = new Map<string, any>();
      for (const row of invRes.rows) {
        if (row.product_id) invByProductId.set(Number(row.product_id), row);
        if (row.sku) invBySku.set(row.sku.trim().toUpperCase(), row);
      }

      // Query thông tin bảng products
      const pConditions: string[] = [];
      const pParams: any[] = [];
      if (itemIds.length > 0) {
        pParams.push(itemIds);
        pConditions.push(`id = ANY($${pParams.length})`);
      }
      if (itemSkus.length > 0) {
        pParams.push(itemSkus);
        pConditions.push(`UPPER(sku) = ANY($${pParams.length})`);
      }
      const pWhere = pConditions.length > 0 ? `WHERE ${pConditions.join(' OR ')}` : '';
      const pRes = await client.query(
        `SELECT id, sku, name, wholesale_price, price, status, is_active 
         FROM products 
         ${pWhere}`,
        pParams
      );

      const productById = new Map<number, any>();
      const productBySku = new Map<string, any>();
      for (const row of pRes.rows) {
        productById.set(Number(row.id), row);
        if (row.sku) productBySku.set(row.sku.trim().toUpperCase(), row);
      }

      // 2.4. Kiểm tra tồn kho khả dụng cho từng mặt hàng (ưu tiên tra theo SKU để khớp chính xác)
      for (const item of mergedItems) {
        const product = (item.sku && productBySku.get(item.sku)) || (item.id && productById.get(item.id));
        if (!product) {
          throw new OrderValidationError(`Sản phẩm ${item.sku || item.id} không tồn tại`, 404);
        }

        const inv = (product && invByProductId.get(product.id)) || (item.id && invByProductId.get(item.id)) || (item.sku && invBySku.get(item.sku)) || invBySku.get(product.sku?.trim().toUpperCase());
        if (!inv) {
          throw new OrderValidationError(`Chưa cấu hình kho cho sản phẩm ${product.name} (${product.sku})`, 400);
        }

        const available = Number(inv.on_hand || 0) - Number(inv.reserved || 0);
        if (available < item.qty) {
          throw new OrderValidationError(
            `Sản phẩm "${product.name}" (${product.sku}) không đủ tồn kho khả dụng (cần: ${item.qty}, còn: ${available})`,
            400
          );
        }
      }

      // 2.5. Chạy Promotion Engine để tính đơn giá sau chiết khấu bậc thang
      const promotionCartItems = mergedItems.map((item) => {
        const product = (item.id && productById.get(item.id)) || (item.sku && productBySku.get(item.sku))!;
        const wholesalePrice = Number(product.wholesale_price || 0);
        const listPrice = Number(product.list_price || product.price || 0);
        const originalPrice = listPrice > 0 ? listPrice : wholesalePrice;
        const baseUnitPrice = wholesalePrice > 0 ? wholesalePrice : originalPrice;

        return {
          sku: product.sku.trim().toUpperCase(),
          quantity: item.qty,
          originalPrice,
          unitPrice: baseUnitPrice,
          categoryDiscountPercent: 0,
          itemDiscountPercent: 0,
          finalPrice: baseUnitPrice,
          totalLineAmount: Math.round(baseUnitPrice * item.qty),
        };
      });

      let customerContext: any = undefined;
      try {
        customerContext = await PromotionContextService.getCustomerContext(String(partnerId));
      } catch (e) {
        console.warn('[OrderService] Không thể tải customer context:', e);
      }

      const promotionResult = await PromotionEngine.calculateCartDynamic(
        promotionCartItems,
        new Date(),
        customerContext
      );

      // 2.6. Sinh mã đơn hàng chuẩn Sxxxxx an toàn từ Sequence (hoặc giữ mã nếu đã là Sxxxxx)
      const orderCode = (clientOrderRef && /^S\d{5,}$/.test(clientOrderRef))
        ? clientOrderRef
        : await generateNextOrderCode(client);

      for (let i = 0; i < mergedItems.length; i++) {
        const item = mergedItems[i];
        const product = (item.id && productById.get(item.id)) || (item.sku && productBySku.get(item.sku))!;
        const inv = (product && invByProductId.get(product.id)) || (item.id && invByProductId.get(item.id)) || (item.sku && invBySku.get(item.sku)) || invBySku.get(product.sku?.trim().toUpperCase());

        const newReserved = Number(inv.reserved || 0) + item.qty;
        const availableBefore = Number(inv.on_hand || 0) - Number(inv.reserved || 0);
        const availableAfter = availableBefore - item.qty;

        await client.query(
          `UPDATE inventory_items 
           SET reserved = $1, updated_at = NOW() 
           WHERE id = $2`,
          [newReserved, inv.id]
        );

        // Ghi nhật ký biến động kho RESERVE
        await client.query(
          `INSERT INTO inventory_transactions 
           (product_id, inventory_item_id, sku, type, quantity, 
            quantity_before, quantity_after, reference_code, reference_type, reason, performed_by)
           VALUES ($1, $2, $3, 'RESERVE', $4, $5, $6, $7, 'SALE_ORDER', $8, 'System')`,
          [
            product.id,
            inv.id,
            product.sku,
            -item.qty,
            availableBefore,
            availableAfter,
            orderCode,
            `Giữ hàng cho đơn ${orderCode}`,
          ]
        );
      }

      // 2.7. Bóc tách & Chuẩn hóa payment_method
      const requestedMethod = String(params.payment_method || '').toLowerCase().trim();
      const validPaymentMethod = ['vnpay', 'cod', 'bank_transfer'].includes(requestedMethod)
        ? requestedMethod
        : 'bank_transfer';

      // Chuẩn hóa địa chỉ giao hàng
      let deliveryAddress = params.delivery_address || '';
      if (!deliveryAddress) {
        if (params.is_custom_address && params.custom_address?.street) {
          deliveryAddress = `${params.custom_address.street}${
            params.custom_address.name ? ' (Người nhận: ' + params.custom_address.name + ')' : ''
          }`;
        } else {
          deliveryAddress = customer.address || 'Địa chỉ đại lý LA PET, Việt Nam';
        }
      }

      const untaxedAmount = promotionResult.subtotal - promotionResult.totalDiscount;
      const discountAmount = promotionResult.totalDiscount;
      const totalAmount = promotionResult.finalTotal;

      // 2.8. Ghi bản ghi vào bảng orders (Mặc định status: draft, payment_status: unpaid)
      const orderInsertRes = await client.query(
        `INSERT INTO orders (
          order_code, customer_id, partner_name, partner_phone, partner_email,
          shipping_name, shipping_address, payment_method,
          status, amount_untaxed, amount_discount, amount_total, payment_status, paid_amount,
          notes, client_order_ref, date_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          'draft', $9, $10, $11, 'unpaid', 0,
          $12, $13, NOW()
        ) RETURNING id, order_code, amount_total, status, payment_method, payment_status, paid_amount, created_at`,
        [
          orderCode,
          partnerId,
          customer.name,
          customer.phone || '',
          customer.email || '',
          cleanText(params.custom_address?.name || customer.name),
          deliveryAddress,
          validPaymentMethod,
          untaxedAmount,
          discountAmount,
          totalAmount,
          cleanText(params.note, 2000),
          clientOrderRef || orderCode,
        ]
      );
      const createdOrder = orderInsertRes.rows[0];

      // 2.9. Ghi các dòng chi tiết vào bảng order_items
      for (let i = 0; i < mergedItems.length; i++) {
        const item = mergedItems[i];
        const product = (item.id && productById.get(item.id)) || (item.sku && productBySku.get(item.sku))!;
        const calcItem = promotionResult.items[i];
        const unitPrice = calcItem ? calcItem.unitPrice : Number(product.wholesale_price || product.price || 0);
        const discountPercent = calcItem ? Number(calcItem.itemDiscountPercent || 0) : 0;
        const subtotal = calcItem ? Number(calcItem.totalLineAmount) : Math.round(unitPrice * item.qty);

        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, sku, product_name, quantity,
            price_unit, discount_percent, price_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            createdOrder.id,
            product.id,
            product.sku,
            product.name,
            item.qty,
            unitPrice,
            discountPercent,
            subtotal,
          ]
        );
      }

      // 2.10. Cập nhật cộng dồn doanh số tích lũy cho đại lý (cumulative_sales)
      await client.query(
        `UPDATE customers 
         SET cumulative_sales = cumulative_sales + $1,
             updated_at = NOW() 
         WHERE id = $2`,
        [totalAmount, partnerId]
      );

      // Ghi log tạo đơn vào order_edit_logs
      await client.query(
        `INSERT INTO order_edit_logs (order_id, order_code, customer_id, action, new_data, performed_by, note)
         VALUES ($1, $2, $3, 'order_created', $4, 'System', 'Khách hàng / Đại lý tạo đơn hàng qua cổng B2B')`,
        [
          createdOrder.id,
          createdOrder.order_code,
          partnerId,
          JSON.stringify({
            amount_total: totalAmount,
            items_count: mergedItems.length,
            shipping_name: cleanText(params.custom_address?.name || customer.name),
            shipping_address: deliveryAddress,
          }),
        ]
      );

      // 2.11. Trả về kết quả hoàn chỉnh
      return {
        success: true,
        id: createdOrder.id,
        order_id: createdOrder.id,
        order_code: createdOrder.order_code,
        code: createdOrder.order_code,
        name: createdOrder.order_code,
        state: 'draft',
        status: 'draft',
        payment_status: 'unpaid',
        paid_amount: 0,
        payment_method: validPaymentMethod,
        amount_untaxed: untaxedAmount,
        amount_discount: discountAmount,
        amount_total: totalAmount,
        total: totalAmount,
        client_order_ref: clientOrderRef || orderCode,
        already_exists: false,
        created_at: createdOrder.created_at,
        promotion: {
          subtotal: promotionResult.subtotal,
          totalDiscount: promotionResult.totalDiscount,
          finalTotal: promotionResult.finalTotal,
          appliedPromotions: promotionResult.appliedPromotions,
          proposedPromotions: promotionResult.proposedPromotions,
        },
      };
    });
  },

  /**
   * Alias cho createQuotation
   */
  async createOrder(params: CreateQuotationParams) {
    return this.createQuotation(params);
  },

  /**
   * Tra cứu đơn hàng theo ID hoặc order_code từ PostgreSQL
   */
  async getOrderById(orderId: number | string, customerId?: number) {
    let sql = `SELECT * FROM orders WHERE (id::text = $1 OR order_code = $1)`;
    const params: any[] = [String(orderId)];

    if (customerId) {
      params.push(customerId);
      sql += ` AND customer_id = $${params.length}`;
    }

    sql += ` LIMIT 1`;

    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    const order = res.rows[0];

    const itemsRes = await query(
      `SELECT oi.*, p.image_url, p.unit 
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id OR UPPER(oi.sku) = UPPER(p.sku)
       WHERE oi.order_id = $1 
       ORDER BY oi.id ASC`,
      [order.id]
    );

    return {
      ...order,
      items: itemsRes.rows,
      order_lines: itemsRes.rows,
    };
  },

  /**
   * Tra cứu đơn hàng tồn tại theo client_order_ref
   */
  async findExistingQuotation(partnerId: number, clientOrderRef: string) {
    const res = await query(
      `SELECT id, order_code, status, amount_untaxed, amount_total, client_order_ref 
       FROM orders 
       WHERE customer_id = $1 AND (client_order_ref = $2 OR order_code = $2) AND status NOT IN ('cancel', 'cancelled')
       ORDER BY created_at DESC LIMIT 1`,
      [partnerId, clientOrderRef]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      code: r.order_code,
      state: r.status,
    };
  },

  /**
   * Cập nhật trạng thái đơn hàng (Fulfillment Status)
   * draft -> confirmed -> delivered -> completed / cancelled
   */
  async updateOrderStatus(orderId: number | string, newStatus: string) {
    const validStatuses = [
      ORDER_STATUS.DRAFT,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.COMPLETED,
      ORDER_STATUS.CANCELLED,
    ];
    if (!validStatuses.includes(newStatus as any)) {
      throw new OrderValidationError(`Trạng thái không hợp lệ: ${newStatus}`, 400);
    }

    return await withTransaction(async (client: PoolClient) => {
      const orderRes = await client.query(
        `SELECT id, order_code, status, payment_status, amount_total, paid_amount, customer_id 
         FROM orders WHERE (id::text = $1 OR order_code = $1) LIMIT 1 FOR UPDATE`,
        [String(orderId)]
      );

      if (orderRes.rows.length === 0) {
        throw new OrderValidationError('Không tìm thấy đơn hàng', 404);
      }

      const order = orderRes.rows[0];
      const currentStatus = order.status;

      if (currentStatus === newStatus) {
        return order;
      }

      if (currentStatus === ORDER_STATUS.CANCELLED) {
        throw new OrderValidationError('Không thể thay đổi trạng thái của đơn hàng đã hủy', 400);
      }

      if (currentStatus === ORDER_STATUS.COMPLETED && newStatus !== ORDER_STATUS.CANCELLED) {
        throw new OrderValidationError('Đơn hàng đã hoàn tất không thể chuyển về trạng thái trước', 400);
      }

      // Chỉ chuyển sang completed khi đã thanh toán đủ 100%
      if (newStatus === ORDER_STATUS.COMPLETED) {
        const isPaid = order.payment_status === PAYMENT_STATUS.PAID || Number(order.paid_amount || 0) >= Number(order.amount_total || 0);
        if (!isPaid) {
          throw new OrderValidationError('Đơn hàng chưa thanh toán đủ 100%, không thể chuyển sang trạng thái Hoàn tất.', 400);
        }
      }

      // Tự động trừ tồn kho thực tế (on_hand) & giải phóng giữ chỗ (reserved) khi giao hàng hoặc hoàn tất
      if (newStatus === ORDER_STATUS.DELIVERED || newStatus === ORDER_STATUS.COMPLETED) {
        const checkDeducted = await client.query(
          `SELECT 1 FROM inventory_transactions 
           WHERE reference_code = $1 AND (reference_type IN ('SALE_ORDER_CONFIRM', 'SALE') OR type = 'SALE') 
           LIMIT 1`,
          [order.order_code]
        );

        if (checkDeducted.rows.length === 0) {
          const itemsRes = await client.query(
            `SELECT sku, product_name, quantity FROM order_items WHERE order_id = $1`,
            [order.id]
          );
          const stockLines = itemsRes.rows.map((row) => ({
            sku: row.sku,
            productName: row.product_name || 'Sản phẩm',
            quantity: Number(row.quantity || 0),
          }));

          await inventoryStorageService.confirmOrderStock(
            stockLines,
            order.order_code,
            'Xuất kho khi giao hàng / hoàn tất đơn',
            client
          );
        }
      }

      // Nếu chuyển sang cancelled: hoàn lại tồn kho & trừ doanh số tích lũy
      if (newStatus === ORDER_STATUS.CANCELLED) {
        const itemsRes = await client.query(
          `SELECT sku, quantity FROM order_items WHERE order_id = $1`,
          [order.id]
        );
        for (const item of itemsRes.rows) {
          if (item.sku && Number(item.quantity) > 0) {
            await inventoryStorageService.releaseStock(
              item.sku,
              Number(item.quantity),
              order.order_code,
              client
            );
          }
        }

        if (order.customer_id && Number(order.amount_total) > 0) {
          await client.query(
            `UPDATE customers 
             SET cumulative_sales = GREATEST(0, cumulative_sales - $1), updated_at = NOW() 
             WHERE id = $2`,
            [Number(order.amount_total), order.customer_id]
          );
        }
      }

      const updateRes = await client.query(
        `UPDATE orders 
         SET status = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING id, order_code, customer_id, status, payment_status, amount_total, paid_amount, updated_at`,
        [newStatus, order.id]
      );

      // Ghi nhật ký vào order_edit_logs
      await client.query(
        `INSERT INTO order_edit_logs (order_id, order_code, customer_id, action, old_data, new_data, performed_by, note)
         VALUES ($1, $2, $3, 'status_change', $4, $5, 'Admin', $6)`,
        [
          order.id,
          order.order_code,
          order.customer_id,
          JSON.stringify({ status: currentStatus }),
          JSON.stringify({ status: newStatus }),
          `Chuyển trạng thái từ "${ORDER_STATUS_LABEL[currentStatus]?.label || currentStatus}" sang "${ORDER_STATUS_LABEL[newStatus]?.label || newStatus}"`,
        ]
      );

      return updateRes.rows[0];
    });
  },

  /**
   * Ghi nhận thanh toán cho đơn hàng
   * Tự động tính toán payment_status: unpaid -> partial -> paid
   * Nếu đã giao hàng (delivered) VÀ trả đủ (paid) -> tự động chuyển sang completed
   */
  async recordPayment(
    orderId: number | string,
    additionalPaid: number,
    paymentMeta?: { method?: string; transactionRef?: string; notes?: string; performedBy?: string }
  ) {
    const numPaid = Number(additionalPaid);
    if (isNaN(numPaid) || numPaid <= 0) {
      throw new OrderValidationError('Số tiền thanh toán phải lớn hơn 0', 400);
    }

    return await withTransaction(async (client: PoolClient) => {
      const orderRes = await client.query(
        `SELECT id, order_code, status, payment_status, amount_total, paid_amount, customer_id 
         FROM orders WHERE (id::text = $1 OR order_code = $1) LIMIT 1 FOR UPDATE`,
        [String(orderId)]
      );

      if (orderRes.rows.length === 0) {
        throw new OrderValidationError('Không tìm thấy đơn hàng', 404);
      }

      const order = orderRes.rows[0];
      const totalAmount = Number(order.amount_total || 0);
      const currentPaid = Number(order.paid_amount || 0);
      const remaining = Math.max(0, totalAmount - currentPaid);

      if (numPaid > remaining && remaining > 0) {
        throw new OrderValidationError(`Số tiền thanh toán (${new Intl.NumberFormat('vi-VN').format(numPaid)} ₫) không thể vượt quá số nợ còn lại (${new Intl.NumberFormat('vi-VN').format(remaining)} ₫)`, 400);
      }

      const newPaid = Math.min(totalAmount, currentPaid + numPaid);

      let newPaymentStatus: string = PAYMENT_STATUS.UNPAID;
      if (newPaid >= totalAmount && totalAmount > 0) {
        newPaymentStatus = PAYMENT_STATUS.PAID;
      } else if (newPaid > 0) {
        newPaymentStatus = PAYMENT_STATUS.PARTIAL;
      }

      let newStatus = order.status;
      // Nếu đã giao hàng và thanh toán đủ -> Tự động hoàn tất
      if (newPaymentStatus === PAYMENT_STATUS.PAID && order.status === ORDER_STATUS.DELIVERED) {
        newStatus = ORDER_STATUS.COMPLETED;
      }

      const method = paymentMeta?.method || 'bank_transfer';
      const ref = paymentMeta?.transactionRef || '';
      const pNotes = paymentMeta?.notes || '';
      const performer = paymentMeta?.performedBy || 'Admin';

      const updateRes = await client.query(
        `UPDATE orders 
         SET paid_amount = $1, payment_status = $2, status = $3, updated_at = NOW() 
         WHERE id = $4 
         RETURNING id, order_code, status, payment_status, amount_total, paid_amount, updated_at`,
        [newPaid, newPaymentStatus, newStatus, order.id]
      );

      // Ghi lịch sử thanh toán chi tiết
      await client.query(
        `INSERT INTO order_payments (order_id, order_code, amount, payment_method, transaction_ref, notes, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, order.order_code, numPaid, method, ref, pNotes, performer]
      );

      // Ghi log hoạt động vào order_edit_logs
      await client.query(
        `INSERT INTO order_edit_logs (order_id, order_code, customer_id, action, old_data, new_data, performed_by, note)
         VALUES ($1, $2, $3, 'payment_recorded', $4, $5, $6, $7)`,
        [
          order.id,
          order.order_code,
          order.customer_id,
          JSON.stringify({ paid_amount: currentPaid, payment_status: order.payment_status }),
          JSON.stringify({ paid_amount: newPaid, payment_status: newPaymentStatus, additional: numPaid, method, transaction_ref: ref }),
          performer,
          `Ghi nhận thanh toán ${new Intl.NumberFormat('vi-VN').format(numPaid)} ₫ qua ${method.toUpperCase()}${ref ? ` (Mã: ${ref})` : ''}`,
        ]
      );

      return updateRes.rows[0];
    });
  },

  /**
   * Cập nhật thông tin chi tiết đơn hàng (Shipping, Note, Items, Re-calculate Pricing & Inventory)
   */
  async updateOrderDetails(
    orderId: number | string,
    payload: {
      shipping_name?: string;
      shipping_phone?: string;
      shipping_address?: string;
      notes?: string;
      items?: Array<{ id?: number; product_id?: number; sku: string; quantity: number }>;
      performedBy?: string;
    }
  ) {
    return await withTransaction(async (client: PoolClient) => {
      // 1. Lock order
      const orderRes = await client.query(
        `SELECT * FROM orders WHERE (id::text = $1 OR order_code = $1) LIMIT 1 FOR UPDATE`,
        [String(orderId)]
      );

      if (orderRes.rows.length === 0) {
        throw new OrderValidationError('Không tìm thấy đơn hàng', 404);
      }

      const order = orderRes.rows[0];
      const performer = payload.performedBy || 'Admin';

      // Chỉ cho phép chỉnh sửa toàn diện khi đơn ở trạng thái DRAFT hoặc CONFIRMED
      if (order.status !== ORDER_STATUS.DRAFT && order.status !== ORDER_STATUS.CONFIRMED) {
        throw new OrderValidationError(
          `Không thể chỉnh sửa mặt hàng của đơn ở trạng thái "${ORDER_STATUS_LABEL[order.status]?.label || order.status}"`,
          400
        );
      }

      // Snapshot dữ liệu cũ để ghi log
      const oldItemsRes = await client.query(
        `SELECT id, product_id, sku, product_name, quantity, price_unit, discount_percent, price_total 
         FROM order_items WHERE order_id = $1 ORDER BY id ASC`,
        [order.id]
      );
      const oldItems = oldItemsRes.rows;
      const oldOrderSnapshot = {
        shipping_name: order.shipping_name,
        shipping_phone: order.partner_phone,
        shipping_address: order.shipping_address,
        notes: order.notes,
        amount_total: Number(order.amount_total),
        items: oldItems,
      };

      // 2. Cập nhật thông tin giao hàng & ghi chú
      const updates: string[] = [];
      const updateParams: any[] = [];
      const newShippingName = payload.shipping_name !== undefined ? cleanText(payload.shipping_name) : order.shipping_name;
      const newShippingPhone = payload.shipping_phone !== undefined ? cleanText(payload.shipping_phone) : order.partner_phone;
      const newShippingAddress = payload.shipping_address !== undefined ? cleanText(payload.shipping_address, 500) : order.shipping_address;
      const newNotes = payload.notes !== undefined ? cleanText(payload.notes, 2000) : order.notes;

      updateParams.push(newShippingName);
      updates.push(`shipping_name = $${updateParams.length}`);

      updateParams.push(newShippingPhone);
      updates.push(`partner_phone = $${updateParams.length}`);

      updateParams.push(newShippingAddress);
      updates.push(`shipping_address = $${updateParams.length}`);

      updateParams.push(newNotes);
      updates.push(`notes = $${updateParams.length}`);

      // 3. Nếu có cập nhật danh sách sản phẩm (items)
      let finalAmountTotal = Number(order.amount_total);
      let finalAmountUntaxed = Number(order.amount_untaxed);
      let finalAmountDiscount = Number(order.amount_discount);
      let recomputedItems: any[] = oldItems;

      if (Array.isArray(payload.items) && payload.items.length > 0) {
        // Gom và lọc số lượng hợp lệ
        const parsedItems = payload.items.map((it: any) => {
          const sku = it.sku ? normalizeSku(it.sku) : '';
          const qty = parseInt(String(it.quantity || it.qty || 1), 10);
          if (isNaN(qty) || qty <= 0) {
            throw new OrderValidationError('Số lượng sản phẩm phải lớn hơn 0', 400);
          }
          return { sku, qty, id: it.id, product_id: it.product_id };
        });

        // Gom trùng SKU
        const mergedMap = new Map<string, { sku: string; qty: number }>();
        for (const it of parsedItems) {
          if (!it.sku) continue;
          const ex = mergedMap.get(it.sku);
          if (ex) {
            ex.qty += it.qty;
          } else {
            mergedMap.set(it.sku, { sku: it.sku, qty: it.qty });
          }
        }
        const mergedList = Array.from(mergedMap.values());
        if (mergedList.length === 0) {
          throw new OrderValidationError('Đơn hàng phải có ít nhất 1 sản phẩm', 400);
        }

        // Lấy thông tin khách hàng để tính chiết khấu
        const custRes = await client.query(`SELECT id, tier, cumulative_sales FROM customers WHERE id = $1`, [order.customer_id]);
        const customer = custRes.rows[0] || { tier: 'STANDARD', cumulative_sales: 0 };

        // Xử lý tồn kho:
        // Đơn hiện tại đang giữ chỗ (reserved) các mặt hàng cũ. Ta hoàn lại lượng cũ trước, rồi check & giữ chỗ lượng mới.
        for (const oldIt of oldItems) {
          if (oldIt.sku && Number(oldIt.quantity) > 0) {
            await inventoryStorageService.releaseStock(oldIt.sku, Number(oldIt.quantity), order.order_code, client);
          }
        }

        // Tra cứu sản phẩm mới và kiểm tra tồn kho
        const itemSkus = mergedList.map((m) => m.sku);
        const invRes = await client.query(
          `SELECT id, product_id, sku, on_hand, reserved, (on_hand - reserved) as available 
           FROM inventory_items 
           WHERE UPPER(sku) = ANY($1) FOR UPDATE`,
          [itemSkus]
        );
        const invBySku = new Map<string, any>();
        for (const row of invRes.rows) {
          if (row.sku) invBySku.set(row.sku.trim().toUpperCase(), row);
        }

        const prodRes = await client.query(
          `SELECT id, sku, name, wholesale_price, price, status, is_active FROM products WHERE UPPER(sku) = ANY($1)`,
          [itemSkus]
        );
        const prodBySku = new Map<string, any>();
        for (const row of prodRes.rows) {
          if (row.sku) prodBySku.set(row.sku.trim().toUpperCase(), row);
        }

        for (const it of mergedList) {
          const prod = prodBySku.get(it.sku);
          if (!prod) {
            throw new OrderValidationError(`Sản phẩm với SKU ${it.sku} không tồn tại`, 404);
          }
          const inv = invBySku.get(it.sku);
          if (!inv) {
            throw new OrderValidationError(`Chưa cấu hình kho cho sản phẩm ${prod.name} (${it.sku})`, 400);
          }
          const available = Number(inv.on_hand || 0) - Number(inv.reserved || 0);
          if (available < it.qty) {
            throw new OrderValidationError(
              `Sản phẩm "${prod.name}" (${it.sku}) không đủ tồn kho (cần: ${it.qty}, còn: ${available})`,
              400
            );
          }
        }

        // Khóa lại tồn kho cho các item mới
        for (const it of mergedList) {
          await inventoryStorageService.reserveStock(it.sku, it.qty, order.order_code, client);
        }

        // Tính lại giá và chiết khấu qua PromotionEngine
        const promotionCartItems = mergedList.map((it) => {
          const product = prodBySku.get(it.sku)!;
          const wholesalePrice = Number(product.wholesale_price || 0);
          const listPrice = Number(product.price || 0);
          const originalPrice = listPrice > 0 ? listPrice : wholesalePrice;
          const baseUnitPrice = wholesalePrice > 0 ? wholesalePrice : originalPrice;

          return {
            sku: product.sku.trim().toUpperCase(),
            quantity: it.qty,
            originalPrice,
            unitPrice: baseUnitPrice,
            categoryDiscountPercent: 0,
            itemDiscountPercent: 0,
            finalPrice: baseUnitPrice,
          };
        });

        const activePromotions = await PromotionContextService.loadActivePromotions();
        const promotionResult = PromotionEngine.calculateCart(
          promotionCartItems,
          customer.tier || 'STANDARD',
          Number(customer.cumulative_sales || 0),
          activePromotions
        );

        finalAmountUntaxed = promotionResult.subtotal - promotionResult.totalDiscount;
        finalAmountDiscount = promotionResult.totalDiscount;
        finalAmountTotal = promotionResult.finalTotal;

        // Xóa order_items cũ và chèn order_items mới
        await client.query(`DELETE FROM order_items WHERE order_id = $1`, [order.id]);

        recomputedItems = [];
        for (let i = 0; i < mergedList.length; i++) {
          const it = mergedList[i];
          const product = prodBySku.get(it.sku)!;
          const calcItem = promotionResult.items[i];
          const unitPrice = calcItem ? calcItem.unitPrice : Number(product.wholesale_price || product.price || 0);
          const discountPercent = calcItem ? Number(calcItem.itemDiscountPercent || 0) : 0;
          const subtotal = calcItem ? Number(calcItem.totalLineAmount) : Math.round(unitPrice * it.qty);

          const insItem = await client.query(
            `INSERT INTO order_items (
              order_id, product_id, sku, product_name, quantity,
              price_unit, discount_percent, price_total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [order.id, product.id, product.sku, product.name, it.qty, unitPrice, discountPercent, subtotal]
          );
          recomputedItems.push(insItem.rows[0]);
        }

        // Cập nhật lại cumulative_sales cho khách hàng (lệch so với đơn cũ)
        const oldTotal = Number(order.amount_total || 0);
        const diffTotal = finalAmountTotal - oldTotal;
        if (order.customer_id && diffTotal !== 0) {
          await client.query(
            `UPDATE customers SET cumulative_sales = GREATEST(0, cumulative_sales + $1), updated_at = NOW() WHERE id = $2`,
            [diffTotal, order.customer_id]
          );
        }

        // Tự động tính lại payment_status nếu tổng tiền thay đổi
        const paidAmount = Number(order.paid_amount || 0);
        let newPaymentStatus = order.payment_status;
        if (paidAmount >= finalAmountTotal && finalAmountTotal > 0) {
          newPaymentStatus = PAYMENT_STATUS.PAID;
        } else if (paidAmount > 0) {
          newPaymentStatus = PAYMENT_STATUS.PARTIAL;
        } else {
          newPaymentStatus = PAYMENT_STATUS.UNPAID;
        }

        updateParams.push(finalAmountUntaxed);
        updates.push(`amount_untaxed = $${updateParams.length}`);

        updateParams.push(finalAmountDiscount);
        updates.push(`amount_discount = $${updateParams.length}`);

        updateParams.push(finalAmountTotal);
        updates.push(`amount_total = $${updateParams.length}`);

        updateParams.push(newPaymentStatus);
        updates.push(`payment_status = $${updateParams.length}`);
      }

      // Thực thi cập nhật orders
      updateParams.push(order.id);
      const updatedOrderRes = await client.query(
        `UPDATE orders SET ${updates.join(', ')}, updated_at = NOW() 
         WHERE id = $${updateParams.length}
         RETURNING *`,
        updateParams
      );
      const updatedOrder = updatedOrderRes.rows[0];

      // Ghi nhật ký vào order_edit_logs
      await client.query(
        `INSERT INTO order_edit_logs (order_id, order_code, customer_id, action, old_data, new_data, performed_by, note)
         VALUES ($1, $2, $3, 'order_edit', $4, $5, $6, $7)`,
        [
          order.id,
          order.order_code,
          order.customer_id,
          JSON.stringify(oldOrderSnapshot),
          JSON.stringify({
            shipping_name: newShippingName,
            shipping_phone: newShippingPhone,
            shipping_address: newShippingAddress,
            notes: newNotes,
            amount_total: finalAmountTotal,
            items: recomputedItems,
          }),
          performer,
          `Chỉnh sửa thông tin đơn hàng và cập nhật danh mục sản phẩm`,
        ]
      );

      return {
        ...updatedOrder,
        items: recomputedItems,
      };
    });
  },

  /**
   * Lấy lịch sử chỉnh sửa & hoạt động của đơn hàng
   */
  async getOrderHistory(orderId: number | string) {
    const res = await query(
      `SELECT * FROM order_edit_logs 
       WHERE order_id::text = $1 OR order_code = $1 
       ORDER BY created_at DESC, id DESC`,
      [String(orderId)]
    );
    return res.rows;
  },

  /**
   * Lấy danh sách các giao dịch thanh toán của đơn hàng
   */
  async getOrderPayments(orderId: number | string) {
    const res = await query(
      `SELECT * FROM order_payments 
       WHERE order_id::text = $1 OR order_code = $1 
       ORDER BY created_at DESC, id DESC`,
      [String(orderId)]
    );
    return res.rows;
  },
};