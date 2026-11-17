// src/services/inventory-storage.service.ts
import { query, withTransaction, getPgPool } from '@/lib/db';
import { getDirectusUrl } from '@/lib/catalog';
import type { PoolClient } from 'pg';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: number;
  productId?: number;
  sku: string;
  productName: string;
  imageUrl?: string;
  category?: string;
  brand?: string;
  unit: string;
  onHand: number;
  reserved: number;
  available: number; // onHand - reserved
  soldQuantity: number;
  minStock: number;
  status: StockStatus;
  statusLabel?: string;
  updatedAt: string;
}

export interface InventoryReceiptLine {
  id?: number;
  sku: string;
  productName?: string;
  quantity: number;
  priceUnit: number;
  subtotal?: number;
}

export interface InventoryReceipt {
  id: number;
  code: string;
  receiptCode?: string;
  supplierName: string;
  deliverTo?: string;
  receiptDate: string;
  notes?: string;
  status: 'draft' | 'completed' | 'cancelled';
  lines: InventoryReceiptLine[];
  totalItems: number;
  totalQuantity: number;
  totalAmount: number;
  createdByName?: string;
  createdAt: string;
}

export type InventoryTransactionType =
  | 'INITIAL_STOCK'
  | 'IMPORT'
  | 'SALE'
  | 'RESERVE'
  | 'ADJUSTMENT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE'
  | 'OTHER';

export interface InventoryTransaction {
  id: number;
  productId?: number;
  sku: string;
  productName: string;
  type: InventoryTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceCode?: string;
  referenceType?: string;
  reason?: string;
  notes?: string;
  performedBy?: string;
  dateCreated: string;
  performedAt?: string;
}

export interface CreateReceiptDTO {
  supplierName: string;
  deliverTo?: string;
  notes?: string;
  lines: Array<{
    sku: string;
    productName?: string;
    quantity: number;
    priceUnit: number;
  }>;
}

export function computeStockStatus(available: number, minStock: number): StockStatus {
  if (available <= 0) return 'out_of_stock';
  if (available <= minStock) return 'low_stock';
  return 'in_stock';
}

export function getStatusLabel(status: StockStatus): string {
  switch (status) {
    case 'in_stock':
      return 'Còn hàng';
    case 'low_stock':
      return 'Sắp hết hàng';
    case 'out_of_stock':
      return 'Hết hàng';
    default:
      return 'Không xác định';
  }
}

interface DirectusActiveProduct {
  name?: string;
  imageId: string | null;
}

function extractDirectusImageId(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (!first) return null;
  if (typeof first === 'string') return first;
  if (typeof first.directus_files_id === 'string') return first.directus_files_id;
  if (first.directus_files_id?.id) return first.directus_files_id.id;
  return null;
}

function resolveInventoryImageUrl(dbImageUrl?: string | null, directusFileId?: string | null): string {
  const thumbQuery = 'width=120&height=120&fit=contain';
  if (directusFileId) {
    return `/api/v1/directus/assets/${directusFileId}?${thumbQuery}`;
  }
  const raw = (dbImageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/v1/directus/assets/') && !raw.includes('?')) {
    return `${raw}?${thumbQuery}`;
  }
  return raw;
}

async function getActiveDirectusProductMap(): Promise<Map<string, DirectusActiveProduct> | null> {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) return null;

  try {
    const res = await fetch(
      `${directusUrl}/items/products?limit=-1&filter[status][_eq]=published&fields=sku,name,images.directus_files_id`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    if (rows.length === 0) return null;

    const map = new Map<string, DirectusActiveProduct>();
    for (const p of rows) {
      const skuKey = String(p?.sku || '').trim().toUpperCase();
      if (!skuKey) continue;
      map.set(skuKey, {
        name: p?.name ? String(p.name) : undefined,
        imageId: extractDirectusImageId(p?.images),
      });
    }
    return map.size > 0 ? map : null;
  } catch {
    return null;
  }
}

export class InventoryStorageService {
  /**
   * Lấy danh sách tồn kho từ bảng inventory_items kết hợp products (chỉ lấy sản phẩm đang có)
   */
  async getItems(options: {
    status?: string;
    search?: string;
    q?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<InventoryItem[]> {
    const directusMap = await getActiveDirectusProductMap();

    let sql = `
      SELECT i.id, i.product_id, i.sku, 
             COALESCE(p.name, i.sku) AS product_name,
             p.image_url, p.category, i.unit,
             i.on_hand, i.reserved, 
             (i.on_hand - i.reserved) AS available,
             0 AS sold_quantity, i.min_stock, i.updated_at
      FROM inventory_items i
      INNER JOIN products p ON (i.product_id = p.id OR UPPER(i.sku) = UPPER(p.sku))
      WHERE (i.is_active = TRUE OR i.is_active IS NULL)
        AND p.is_active = TRUE
        AND p.status = 'published'
    `;
    const params: any[] = [];

    if (directusMap) {
      params.push(Array.from(directusMap.keys()));
      sql += ` AND UPPER(TRIM(i.sku)) = ANY($${params.length})`;
    }

    const searchTerm = (options.search || options.q || '').trim();
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      sql += ` AND (i.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`;
    }

    if (options.category && options.category !== 'all') {
      params.push(options.category);
      sql += ` AND p.category = $${params.length}`;
    }

    if (options.status && options.status !== 'all') {
      if (options.status === 'in_stock') {
        sql += ` AND (i.on_hand - i.reserved) > i.min_stock`;
      } else if (options.status === 'low_stock') {
        sql += ` AND (i.on_hand - i.reserved) > 0 AND (i.on_hand - i.reserved) <= i.min_stock`;
      } else if (options.status === 'out_of_stock') {
        sql += ` AND (i.on_hand - i.reserved) <= 0`;
      }
    }

    sql += ` ORDER BY i.id ASC`;

    if (options.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
      if (options.offset) {
        params.push(options.offset);
        sql += ` OFFSET $${params.length}`;
      }
    }

    const res = await query(sql, params);
    return res.rows.map((row) => {
      const onHand = Number(row.on_hand || 0);
      const reserved = Number(row.reserved || 0);
      const available = onHand - reserved;
      const minStock = Number(row.min_stock || 10);
      const st = computeStockStatus(available, minStock);
      const directusInfo = directusMap?.get(String(row.sku || '').trim().toUpperCase());

      return {
        id: row.id,
        productId: row.product_id,
        sku: row.sku,
        productName: directusInfo?.name || row.product_name,
        imageUrl: resolveInventoryImageUrl(row.image_url, directusInfo?.imageId),
        category: row.category || 'Mặc định',
        brand: 'LA PET',
        unit: row.unit || 'Cái',
        onHand,
        reserved,
        available,
        soldQuantity: Number(row.sold_quantity || 0),
        minStock,
        status: st,
        statusLabel: getStatusLabel(st),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      };
    });
  }

  /**
   * Lấy một sản phẩm tồn kho theo SKU
   */
  async getItemBySku(sku: string): Promise<InventoryItem | null> {
    const res = await query(
      `SELECT i.id, i.product_id, i.sku, 
              COALESCE(p.name, i.sku) AS product_name,
              p.image_url, p.category, i.unit,
              i.on_hand, i.reserved, 
              (i.on_hand - i.reserved) AS available,
              0 AS sold_quantity, i.min_stock, i.updated_at
       FROM inventory_items i
       LEFT JOIN products p ON i.product_id = p.id OR UPPER(i.sku) = UPPER(p.sku)
       WHERE UPPER(i.sku) = UPPER($1)
       LIMIT 1`,
      [sku.trim()]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const onHand = Number(row.on_hand || 0);
    const reserved = Number(row.reserved || 0);
    const available = onHand - reserved;
    const minStock = Number(row.min_stock || 10);
    const st = computeStockStatus(available, minStock);

    return {
      id: row.id,
      productId: row.product_id,
      sku: row.sku,
      productName: row.product_name,
      imageUrl: resolveInventoryImageUrl(row.image_url),
      category: row.category || 'Mặc định',
      brand: 'LA PET',
      unit: row.unit || 'Cái',
      onHand,
      reserved,
      available,
      soldQuantity: Number(row.sold_quantity || 0),
      minStock,
      status: st,
      statusLabel: getStatusLabel(st),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Giữ chỗ tồn kho (RESERVE) với khóa hàng SELECT ... FOR UPDATE chống Race Condition
   */
  async reserveStock(sku: string, qty: number, orderCode?: string, client?: PoolClient): Promise<boolean> {
    const runner = async (c: PoolClient) => {
      // 1. SELECT ... FOR UPDATE row-level lock
      const lockRes = await c.query(
        `SELECT id, product_id, sku, on_hand, reserved, 
                (on_hand - reserved) as available 
         FROM inventory_items 
         WHERE UPPER(sku) = UPPER($1) 
         FOR UPDATE`,
        [sku.trim()]
      );

      if (lockRes.rows.length === 0) {
        console.warn(`[InventoryStorage] SKU ${sku} không tồn tại trong kho để giữ chỗ.`);
        return false;
      }

      const item = lockRes.rows[0];
      const available = Number(item.on_hand || 0) - Number(item.reserved || 0);

      if (available < qty) {
        throw new Error(`Sản phẩm ${sku} không đủ tồn kho khả dụng (yêu cầu: ${qty}, khả dụng: ${available})`);
      }

      // 2. Cập nhật số lượng giữ chỗ
      const newReserved = Number(item.reserved || 0) + qty;
      await c.query(
        `UPDATE inventory_items 
         SET reserved = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newReserved, item.id]
      );

      // 3. Ghi nhật ký biến động kho (Audit Trail)
      await c.query(
        `INSERT INTO inventory_transactions 
         (product_id, inventory_item_id, sku, type, quantity, 
          quantity_before, quantity_after, reference_code, reference_type, reason, performed_by)
        VALUES ($1, $2, $3, 'RESERVE', $4, $5, $6, $7, 'SALE_ORDER', $8, 'System')`,
        [
          item.product_id,
          item.id,
          item.sku,
          -qty,
          available,
          available - qty,
          orderCode || null,
          `Giữ hàng cho đơn ${orderCode || ''}`,
        ]
      );

      return true;
    };

    if (client) {
      return await runner(client);
    }
    return await withTransaction(runner);
  }

  /**
   * Giải phóng số lượng giữ chỗ (RELEASE) khi đơn hủy
   */
  async releaseStock(sku: string, qty: number, orderCode?: string, client?: PoolClient): Promise<boolean> {
    const runner = async (c: PoolClient) => {
      const lockRes = await c.query(
        `SELECT id, product_id, sku, on_hand, reserved, 
                (on_hand - reserved) as available 
         FROM inventory_items 
         WHERE UPPER(sku) = UPPER($1) 
         FOR UPDATE`,
        [sku.trim()]
      );

      if (lockRes.rows.length === 0) return false;
      const item = lockRes.rows[0];
      const newReserved = Math.max(0, Number(item.reserved || 0) - qty);
      const availableBefore = Number(item.on_hand || 0) - Number(item.reserved || 0);
      const availableAfter = Number(item.on_hand || 0) - newReserved;

      await c.query(
        `UPDATE inventory_items 
         SET reserved = $1, updated_at = NOW() 
         WHERE id = $2`,
        [newReserved, item.id]
      );

      await c.query(
        `INSERT INTO inventory_transactions 
         (product_id, inventory_item_id, sku, type, quantity, 
          quantity_before, quantity_after, reference_code, reference_type, reason, performed_by)
        VALUES ($1, $2, $3, 'ADJUSTMENT', $4, $5, $6, $7, 'SALE_ORDER_CANCEL', $8, 'System')`,
        [
          item.product_id,
          item.id,
          item.sku,
          qty,
          availableBefore,
          availableAfter,
          orderCode || null,
          `Giải phóng giữ chỗ đơn hủy ${orderCode || ''}`,
        ]
      );

      return true;
    };

    if (client) {
      return await runner(client);
    }
    return await withTransaction(runner);
  }

  /**
   * Xác nhận trừ tồn kho thực tế khi đơn hàng hoàn tất hoặc thanh toán thành công
   */
  async confirmOrderStock(
    lines: Array<{ sku: string; productName?: string; quantity: number }>,
    orderCode: string,
    performedBy: string = 'System',
    client?: PoolClient
  ): Promise<boolean> {
    const runner = async (c: PoolClient) => {
      for (const line of lines) {
        if (!line.sku || line.quantity <= 0) continue;

        const lockRes = await c.query(
          `SELECT id, product_id, sku, on_hand, reserved 
           FROM inventory_items 
           WHERE UPPER(sku) = UPPER($1) 
           FOR UPDATE`,
          [line.sku.trim()]
        );

        if (lockRes.rows.length > 0) {
          const item = lockRes.rows[0];
          const onHandBefore = Number(item.on_hand || 0);
          const newOnHand = Math.max(0, onHandBefore - line.quantity);
          const newReserved = Math.max(0, Number(item.reserved || 0) - line.quantity);

          await c.query(
            `UPDATE inventory_items 
             SET on_hand = $1, 
                 reserved = $2, 
                 updated_at = NOW() 
             WHERE id = $3`,
            [newOnHand, newReserved, item.id]
          );

          await c.query(
            `INSERT INTO inventory_transactions 
             (product_id, inventory_item_id, sku, type, quantity, 
              quantity_before, quantity_after, reference_code, reference_type, reason, performed_by)
            VALUES ($1, $2, $3, 'SALE', $4, $5, $6, $7, 'SALE_ORDER_CONFIRM', $8, $9)`,
            [
              item.product_id,
              item.id,
              item.sku,
              -line.quantity,
              onHandBefore,
              newOnHand,
              orderCode,
              `Xuất kho bán hàng đơn ${orderCode}`,
              performedBy,
            ]
          );
        }
      }
      return true;
    };

    if (client) {
      return await runner(client);
    }
    return await withTransaction(runner);
  }

  /**
   * Tạo phiếu nhập kho (Receipt) trong transaction nguyên tử
   */
  async createReceipt(
    dto: CreateReceiptDTO,
    createdBy: string = 'Admin'
  ): Promise<InventoryReceipt> {
    return await withTransaction(async (c: PoolClient) => {
      const code = `PNK-${Date.now().toString().slice(-6)}`;
      const totalItems = dto.lines.length;
      const totalQuantity = dto.lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const totalAmount = dto.lines.reduce(
        (sum, l) => sum + Number(l.quantity || 0) * Number(l.priceUnit || 0),
        0
      );

      // 1. Tạo phiếu nhập kho trong inventory_receipts
      const receiptRes = await c.query(
        `INSERT INTO inventory_receipts 
         (receipt_code, supplier_name, deliver_to, total_items, 
          total_quantity, total_amount, status, notes, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8)
         RETURNING *`,
        [
          code,
          dto.supplierName || 'Nhà cung cấp LA PET',
          dto.deliverTo || 'Kho Tổng LA PET - TP.HCM',
          totalItems,
          totalQuantity,
          totalAmount,
          dto.notes || '',
          createdBy,
        ]
      );
      const receipt = receiptRes.rows[0];

      // 2. Duyệt qua từng dòng sản phẩm với SELECT ... FOR UPDATE
      for (const line of dto.lines) {
        const cleanSku = line.sku.trim();
        const qty = Number(line.quantity || 0);
        if (!cleanSku || qty <= 0) continue;

        // Khóa hoặc tìm item trong inventory_items
        let itemRes = await c.query(
          `SELECT id, product_id, sku, on_hand, reserved 
           FROM inventory_items 
           WHERE UPPER(sku) = UPPER($1) 
           FOR UPDATE`,
          [cleanSku]
        );

        let itemId: number;
        let productId: number | null = null;
        let onHandBefore = 0;

        if (itemRes.rows.length === 0) {
          // Tìm product tương ứng
          const pRes = await c.query(
            `SELECT id, name, unit FROM products WHERE UPPER(sku) = UPPER($1) LIMIT 1`,
            [cleanSku]
          );
          if (pRes.rows.length > 0) {
            productId = pRes.rows[0].id;
          }
          const insertItem = await c.query(
            `INSERT INTO inventory_items (product_id, sku, on_hand, reserved, min_stock)
             VALUES ($1, $2, $3, 0, 10)
             RETURNING id, on_hand`,
            [productId, cleanSku, qty]
          );
          itemId = insertItem.rows[0].id;
          onHandBefore = 0;
        } else {
          const item = itemRes.rows[0];
          itemId = item.id;
          productId = item.product_id;
          onHandBefore = Number(item.on_hand || 0);

          await c.query(
            `UPDATE inventory_items 
             SET on_hand = on_hand + $1, updated_at = NOW() 
             WHERE id = $2`,
            [qty, itemId]
          );
        }

        // Ghi transaction IMPORT
        await c.query(
          `INSERT INTO inventory_transactions 
           (product_id, receipt_id, inventory_item_id, sku, type, quantity, 
            quantity_before, quantity_after, reference_code, reference_type, reason, performed_by)
          VALUES ($1, $2, $3, $4, 'IMPORT', $5, $6, $7, $8, 'RECEIPT', $9, $10)`,
          [
            productId,
            receipt.id,
            itemId,
            cleanSku,
            qty,
            onHandBefore,
            onHandBefore + qty,
            code,
            `Nhập kho theo phiếu ${code}`,
            createdBy,
          ]
        );
      }

      return {
        id: receipt.id,
        code: receipt.receipt_code,
        receiptCode: receipt.receipt_code,
        supplierName: receipt.supplier_name,
        deliverTo: receipt.deliver_to,
        receiptDate: receipt.receipt_date,
        notes: receipt.notes,
        status: receipt.status,
        lines: dto.lines.map((l) => ({ ...l, subtotal: l.quantity * l.priceUnit })),
        totalItems,
        totalQuantity,
        totalAmount,
        createdByName: receipt.created_by_name,
        createdAt: receipt.created_at ? new Date(receipt.created_at).toISOString() : new Date().toISOString(),
      };
    });
  }

  /**
   * Lấy danh sách phiếu nhập kho từ bảng inventory_receipts
   */
  async getReceipts(options: { limit?: number; search?: string } = {}): Promise<InventoryReceipt[]> {
    let sql = `SELECT * FROM inventory_receipts`;
    const params: any[] = [];

    if (options.search) {
      params.push(`%${options.search}%`);
      sql += ` WHERE receipt_code ILIKE $1 OR supplier_name ILIKE $1`;
    }

    sql += ` ORDER BY id DESC`;

    if (options.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    const res = await query(sql, params);
    return res.rows.map((r) => ({
      id: r.id,
      code: r.receipt_code || r.code,
      receiptCode: r.receipt_code || r.code,
      supplierName: r.supplier_name || r.supplier || '',
      deliverTo: r.deliver_to,
      receiptDate: r.receipt_date,
      notes: r.notes,
      status: r.status,
      lines: [],
      totalItems: Number(r.total_items || 0),
      totalQuantity: Number(r.total_quantity || 0),
      totalAmount: Number(r.total_amount || 0),
      createdByName: r.created_by_name || r.created_by || 'Admin',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  /**
   * Lấy lịch sử biến động kho từ bảng inventory_transactions
   */
  async getTransactions(options: {
    sku?: string;
    type?: string;
    limit?: number;
  } = {}): Promise<InventoryTransaction[]> {
    let sql = `
      SELECT t.*, COALESCE(t.sku, p.sku) as resolved_sku, 
             COALESCE(p.name, t.sku) as product_name
      FROM inventory_transactions t
      LEFT JOIN products p ON t.product_id = p.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.sku) {
      params.push(options.sku.trim());
      conditions.push(`UPPER(t.sku) = UPPER($${params.length})`);
    }

    if (options.type && options.type !== 'all') {
      params.push(options.type);
      conditions.push(`t.type = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY t.id DESC`;

    if (options.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    const res = await query(sql, params);
    return res.rows.map((t) => ({
      id: t.id,
      productId: t.product_id,
      sku: t.resolved_sku || t.sku,
      productName: t.product_name || `Sản phẩm ${t.sku}`,
      type: t.type,
      quantity: Number(t.quantity || 0),
      quantityBefore: Number(t.quantity_before || 0),
      quantityAfter: Number(t.quantity_after || 0),
      referenceCode: t.reference_code,
      referenceType: t.reference_type,
      reason: t.reason,
      notes: t.notes,
      performedBy: t.performed_by || 'System',
      dateCreated: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      performedAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  /**
   * Thống kê KPI tồn kho
   */
  async getStats() {
    const res = await query(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(i.on_hand), 0) as total_stock,
        COUNT(*) FILTER (WHERE (i.on_hand - i.reserved) > i.min_stock) as in_stock_count,
        COUNT(*) FILTER (WHERE (i.on_hand - i.reserved) > 0 AND (i.on_hand - i.reserved) <= i.min_stock) as low_stock_count,
        COUNT(*) FILTER (WHERE (i.on_hand - i.reserved) <= 0) as out_of_stock_count
      FROM inventory_items i
      INNER JOIN products p ON (i.product_id = p.id OR UPPER(i.sku) = UPPER(p.sku))
      WHERE (i.is_active = TRUE OR i.is_active IS NULL)
        AND p.is_active = TRUE
        AND p.status = 'published'
    `);
    const r = res.rows[0];
    return {
      totalItems: Number(r.total_items || 0),
      totalStock: Number(r.total_stock || 0),
      inStockCount: Number(r.in_stock_count || 0),
      lowStockCount: Number(r.low_stock_count || 0),
      outOfStockCount: Number(r.out_of_stock_count || 0),
    };
  }
}

export const inventoryStorageService = new InventoryStorageService();
