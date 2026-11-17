// src/pages/api/admin/inventory/transactions.ts
import type { APIRoute } from 'astro';
import { inventoryStorageService } from '@/services/inventory-storage.service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const sku = url.searchParams.get('sku') || '';
    const type = url.searchParams.get('type') || '';
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));

    const transactions = await inventoryStorageService.getTransactions({ sku, type, limit });

    return new Response(
      JSON.stringify({
        success: true,
        data: transactions,
        total: transactions.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Lỗi lấy nhật ký biến động kho' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
