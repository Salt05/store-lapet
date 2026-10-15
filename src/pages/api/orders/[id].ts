import type { APIRoute } from 'astro';
import { odooReader } from '@/lib/odoo';

interface OdooOrder {
  id: number;
  name?: string;
  amount_total?: number;
  state: string;
  order_line?: number[];
}

interface OdooOrderLine {
  id: number;
  product_id?: [number, string] | false;
  name?: string;
  product_uom_qty?: number;
  price_unit?: number;
  price_subtotal?: number;
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const paramId = params.id;
    const auth = locals.auth;

    // 1. Kiểm tra xác thực Server-side chặt chẽ
    if (!auth?.isAuthenticated || !auth?.isDealer || !auth?.partnerId) {
      return new Response(
        JSON.stringify({ error: 'Chưa đăng nhập đại lý' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const partnerId = Number(auth.partnerId);
    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return new Response(
        JSON.stringify({ error: 'Thông tin đại lý không hợp lệ' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!paramId) {
      return new Response(
        JSON.stringify({ error: 'Mã đơn hàng không hợp lệ' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. Tra cứu qua OCMS Backend trước (phản hồi siêu nhanh < 30ms và hỗ trợ tra cứu theo mã Web WEB-B2B-...)
    const ocmsBaseUrl = (process.env.OCMS_BACKEND_URL || 'http://localhost:3080').replace(/\/+$/, '');
    try {
      const ocmsRes = await fetch(`${ocmsBaseUrl}/api/v1/internal/orders/lookup?code=${encodeURIComponent(paramId)}&partner_id=${partnerId}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (ocmsRes.ok) {
        const ocmsJson = await ocmsRes.json();
        if (ocmsJson.success && ocmsJson.data) {
          return new Response(
            JSON.stringify(ocmsJson.data),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }
    } catch (ocmsErr: any) {
      console.warn('[API Orders Detail] Tra cứu OCMS không khả dụng, chuyển sang Odoo:', ocmsErr.message);
    }

    // 3. Fallback sang Odoo XML-RPC
    // Chú ý: Odoo domain dùng prefix notation: '|' chỉ áp dụng cho 2 điều kiện ngay sau đó
    const isNumeric = /^\d+$/.test(paramId);
    const domain = isNumeric 
      ? [['id', '=', Number(paramId)], ['partner_id', '=', partnerId]] 
      : [
          '&',
          ['partner_id', '=', partnerId],
          ['|',
            ['name', '=', paramId],
            ['client_order_ref', '=', paramId]
          ]
        ];


    const orderResponse = await odooReader.executeKw(
      'sale.order',
      'search_read',
      [domain],
      { fields: ['id', 'name', 'amount_total', 'state', 'order_line', 'client_order_ref'], limit: 1 }
    );

    const orders = (orderResponse || []) as (OdooOrder & { client_order_ref?: string })[];

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy đơn hàng' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const order = orders[0];

    // 4. Lấy danh sách chi tiết các dòng sản phẩm (order_line)
    let items: any[] = [];
    if (order.order_line && order.order_line.length > 0) {
      const lineResponse = await odooReader.executeKw(
        'sale.order.line',
        'read',
        [order.order_line],
        { fields: ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal'] }
      );

      const lines = (lineResponse || []) as OdooOrderLine[];

      items = lines.map((line) => {
        let prodName = line.name || '';
        if (Array.isArray(line.product_id)) {
          prodName = line.product_id[1];
        }

        return {
          id: line.id,
          name: prodName,
          qty: line.product_uom_qty || 0,
          price: line.price_unit || 0,
          subtotal: line.price_subtotal || 0
        };
      });
    }

    return new Response(
      JSON.stringify({
        id: order.name || order.id,
        order_code: order.name || order.id,
        raw_id: order.id,
        amount_total: order.amount_total || 0,
        state: order.state,
        items: items
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (err: any) {
    console.error('Odoo Detail API Error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Lỗi kết nối Odoo' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};