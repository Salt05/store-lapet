import type { APIRoute } from 'astro';
import { odooReader } from '@/lib/odoo';

interface OdooOrder {
  id: number;
  name?: string;
  date_order?: string;
  amount_total?: number;
  state: string;
  order_line?: number[];
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const auth = locals.auth;

    // 1. Kiểm tra xác thực Server-side
    if (!auth?.isAuthenticated || !auth?.isDealer || !auth?.partnerId) {
      return new Response(
        JSON.stringify({ error: 'Chưa đăng nhập đại lý' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate partnerId
    const partnerId = Number(auth.partnerId);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return new Response(
        JSON.stringify({ error: 'Thông tin đại lý không hợp lệ' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ocmsBaseUrl = (process.env.OCMS_BACKEND_URL || 'http://localhost:3080').replace(/\/+$/, '');

    // 3. Ưu tiên lấy từ OCMS CRM (by-partner) — mã đơn đã chuẩn hóa thành SO Odoo (S02398)
    try {
      const ocmsRes = await fetch(`${ocmsBaseUrl}/api/v1/internal/orders/by-partner/${partnerId}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (ocmsRes.ok) {
        const ocmsJson = await ocmsRes.json();
        if (ocmsJson.success && Array.isArray(ocmsJson.data) && ocmsJson.data.length > 0) {
          // Lọc bỏ các đơn có mã WEB tạm thời chưa được đồng bộ mã SO Odoo
          const cleanData = ocmsJson.data.filter((o: any) => {
            const id = String(o.id || '');
            return !id.startsWith('WEB-B2B-') && !id.startsWith('ORD-');
          });
          if (cleanData.length > 0) {
            return new Response(JSON.stringify(cleanData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      }
    } catch (ocmsErr: any) {
      console.warn('[API Orders History] OCMS CRM không phản hồi, thử lấy từ Odoo:', ocmsErr.message);
    }

    // 4. Fallback sang Odoo XML-RPC nếu OCMS CRM rỗng hoặc lỗi
    try {
      const response = await odooReader.executeKw(
        'sale.order',
        'search_read',
        [[['partner_id', '=', partnerId]]],
        {
          fields: ['id', 'name', 'date_order', 'amount_total', 'state', 'order_line'],
          limit: 50,
          order: 'date_order desc'
        }
      );

      const orders = (response || []) as OdooOrder[];

      if (orders && orders.length > 0) {
        const result = orders.map((ord: OdooOrder) => ({
          // Luôn dùng mã SO Odoo (S02398) làm id để hiển thị đúng trên giao diện
          id: ord.name || String(ord.id),
          raw_id: ord.id,
          date: ord.date_order ? ord.date_order.split(' ')[0] : '',
          amount_total: ord.amount_total || 0,
          state: ord.state,
          items_count: ord.order_line ? ord.order_line.length : 0
        }));

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (odooErr: any) {
      console.warn('[API Orders History] Odoo không phản hồi:', odooErr.message);
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Odoo API History Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi kết nối Odoo' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};