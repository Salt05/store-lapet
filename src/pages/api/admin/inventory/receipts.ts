// src/pages/api/admin/inventory/receipts.ts
import type { APIRoute } from 'astro';
import { inventoryStorageService } from '@/services/inventory-storage.service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));

    const receipts = await inventoryStorageService.getReceipts({ q, page, limit });

    return new Response(
      JSON.stringify({
        success: true,
        data: receipts,
        total: receipts.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi lấy danh sách phiếu nhập' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu JSON không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { supplierName, deliverTo, notes, lines } = body || {};

    if (!supplierName || typeof supplierName !== 'string' || !supplierName.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên nhà cung cấp không được để trống' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phiếu nhập phải có ít nhất một dòng mặt hàng' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    for (const line of lines) {
      if (!line.sku || typeof line.sku !== 'string' || !line.sku.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mã SKU không được để trống trong dòng phiếu' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (typeof line.quantity !== 'number' || line.quantity <= 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Số lượng nhập cho SKU ${line.sku} phải lớn hơn 0`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const adminAuth = (locals as any)?.adminAuth;
    const adminName = adminAuth?.adminName || 'Quản trị viên';

    const newReceipt = await inventoryStorageService.createReceipt(
      {
        supplierName: supplierName.trim(),
        deliverTo: deliverTo?.trim(),
        notes: notes?.trim(),
        lines,
      },
      adminName
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tạo phiếu nhập kho thành công',
        data: newReceipt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi tạo phiếu nhập kho' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
