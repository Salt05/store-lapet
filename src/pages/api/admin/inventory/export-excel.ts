// src/pages/api/admin/inventory/export-excel.ts
import type { APIRoute } from 'astro';
import { inventoryStorageService } from '@/services/inventory-storage.service';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await inventoryStorageService.getItems();

    const headers = [
      'STT',
      'Mã SKU',
      'Tên Sản Phẩm',
      'Ngành Hàng',
      'ĐVT',
      'Tồn Thực Tế (On Hand)',
      'Đang Giữ Chỗ (Reserved)',
      'Tồn Khả Dụng (Available)',
      'Định Mức Tối Thiểu (Min Stock)',
      'Trạng Thái Kho',
    ];

    const rows = items.map((it: any, idx: number) => {
      const statusLabel =
        it.status === 'in_stock'
          ? 'Đủ hàng'
          : it.status === 'low_stock'
          ? 'Sắp hết hàng'
          : 'Hết hàng';

      return [
        idx + 1,
        it.sku || '',
        it.productName || '',
        it.category || 'Chung',
        it.unit || 'Cái',
        it.onHand ?? it.current_stock ?? 0,
        it.reserved ?? it.reserved_stock ?? 0,
        it.available ?? it.available_stock ?? 0,
        it.minStock ?? it.min_stock ?? 10,
        statusLabel,
      ];
    });

    const BOM = '\uFEFF';
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

    const filename = `Bao_Cao_Ton_Kho_LA_PET_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(BOM + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[Inventory Export Excel Error]:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
