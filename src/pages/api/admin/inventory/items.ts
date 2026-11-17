// src/pages/api/admin/inventory/items.ts
import type { APIRoute } from 'astro';
import { inventoryStorageService } from '@/services/inventory-storage.service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const status = url.searchParams.get('status') || '';
    const category = url.searchParams.get('category') || '';

    const items = await inventoryStorageService.getItems({ q, status, category });

    return new Response(
      JSON.stringify({
        success: true,
        data: items,
        total: items.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi lấy danh sách tồn kho' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PATCH: APIRoute = async ({ request }) => {
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

    const { sku, minStock } = body || {};

    if (!sku || typeof sku !== 'string' || !sku.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã SKU không được để trống' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (minStock === undefined || minStock === null || isNaN(Number(minStock)) || Number(minStock) < 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Định mức tồn tối thiểu (minStock) phải là số >= 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await inventoryStorageService.updateMinStock(sku.trim(), Number(minStock));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật định mức tồn tối thiểu thành công',
        data: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi cập nhật định mức tồn' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
