import type { APIRoute } from 'astro';
import { odooReader } from '@/lib/odoo';

interface OdooSalesOrder {
  date_order?: string;
  amount_total?: number;
}

export const GET: APIRoute = async ({ request, cookies, locals }) => {
  try {
    // 💡 ĐỌC PARTNER_ID TỪ QUERY PARAM, COOKIES, HOẶC LOCALS
    const url = new URL(request.url);
    const queryPartnerId = url.searchParams.get('partner_id');
    const cookiePartnerId = cookies.get('partner_id')?.value;
    const localPartnerId = (locals as any)?.user?.partner_id;

    const partnerIdStr = queryPartnerId || cookiePartnerId || localPartnerId;
    const partnerId = partnerIdStr ? Number(partnerIdStr) : null;

    if (!partnerId || Number.isNaN(partnerId)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 🎯 CHỈ TÍNH DOANH SỐ CHO ĐƠN HÀNG CỦA PARTNER NÀY VÀ ĐÃ XÁC NHẬN (sale/done)
    const domain: any[] = [
      ['partner_id', '=', partnerId],
      ['state', 'in', ['sale', 'done']]
    ];
    const fields = ['date_order', 'amount_total'];

    // Sử dụng odooReader từ @/lib/odoo (Đọc cấu hình tự động từ .env, hỗ trợ pool và timeout)
    const orders = await odooReader.executeKw(
      'sale.order',
      'search_read',
      [domain],
      { fields }
    );

    const salesByYear: Record<string, number> = {};
    (orders || []).forEach((ord: OdooSalesOrder) => {
      if (ord.date_order) {
        const year = ord.date_order.substring(0, 4);
        salesByYear[year] = (salesByYear[year] || 0) + (ord.amount_total || 0);
      }
    });

    const result = Object.keys(salesByYear)
      .sort((a, b) => Number(b) - Number(a))
      .map((year) => ({
        year,
        total: salesByYear[year]
      }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[SalesSummary] Lỗi tính doanh số:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};