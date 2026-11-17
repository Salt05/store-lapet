// src/pages/api/customers/sales-summary.ts
import type { APIRoute } from 'astro';
import { customerService } from '@/services/customer.service';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const auth = locals.auth;
    const qCustomerId = url.searchParams.get('customer_id');

    let partnerId = Number(auth?.partnerId);
    if ((!partnerId || isNaN(partnerId)) && qCustomerId) {
      partnerId = Number(qCustomerId);
    }

    if (!partnerId || isNaN(partnerId) || partnerId <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa đăng nhập đại lý hoặc thiếu customer_id hợp lệ' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const summary = await customerService.getSalesSummary(partnerId);
    if (!summary.success) {
      return new Response(
        JSON.stringify({ success: false, error: summary.error || 'Không tìm thấy dữ liệu đại lý' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_sales: summary.total_sales,
        order_count: summary.order_count,
        current_tier: summary.current_tier,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API Sales Summary Error]:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi tính toán doanh số' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};