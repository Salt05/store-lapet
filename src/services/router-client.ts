/**
 * Router Client - Kết nối trực tiếp từ Web Bán Hàng (store-lapet) tới OCMS Universal Router
 * Thay thế hoàn toàn cho việc gọi Odoo XML-RPC trực tiếp trên Frontend.
 */

export function getRouterUrl(): string {
  let url =
    (typeof process !== 'undefined' && process.env?.ROUTER_API_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.ROUTER_API_URL) ||
    'http://127.0.0.1:3001';

  url = url.trim().replace(/\/+$/, '');
  if (url.startsWith('http://localhost:')) {
    url = url.replace('http://localhost:', 'http://127.0.0.1:');
  }
  return url;
}

export interface StandardOrderItem {
  sku: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface StandardOrderPayload {
  order_code: string;
  source: string;
  partner_id?: number | null;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  items: StandardOrderItem[];
  total_amount: number;
  payment_method: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface RouterOrderResponse {
  order_code: string;
  tracking_id: string;
  status: string;
  received_at: string;
  dispatched?: Array<{
    target_id: string;
    target_name: string;
    target_system: string;
    queue: string;
    action: string;
    job_id?: string;
  }>;
  skipped?: string[];
  execution_time_ms: number;
}

/**
 * Gửi đơn hàng chuẩn hóa sang OCMS Universal Router
 * Tốc độ phản hồi: < 30ms (do Router đưa vào hàng đợi Redis xử lý ngầm)
 */
export async function submitOrderToRouter(payload: StandardOrderPayload): Promise<RouterOrderResponse> {
  const routerBaseUrl = getRouterUrl().replace(/\/+$/, '');
  const endpoint = `${routerBaseUrl}/api/v1/orders/standard`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // Timeout sau 10s
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errorMsg = result.details
        ? result.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
        : (result.error || 'Lỗi gửi đơn qua Router trung tâm');
      throw new Error(errorMsg);
    }

    return result.data as RouterOrderResponse;
  } catch (err: any) {
    console.error('[RouterClient] Lỗi kết nối đến Router:', err.message);
    throw new Error(err.message || 'Không thể kết nối đến Cổng Router Trung Tâm');
  }
}

/**
 * Tra cứu tiến độ xử lý đơn hàng từ Router
 */
export async function checkOrderStatusFromRouter(orderCode: string): Promise<any> {
  const routerBaseUrl = getRouterUrl().replace(/\/+$/, '');
  const endpoint = `${routerBaseUrl}/api/v1/orders/standard/${encodeURIComponent(orderCode)}`;

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(5000),
  });

  return await response.json();
}

/**
 * Hủy đơn hàng thông qua OCMS Universal Router (Thao tác Write/Action)
 */
export async function cancelOrderViaRouter(orderCode: string, reason?: string): Promise<any> {
  const routerBaseUrl = getRouterUrl().replace(/\/+$/, '');
  const endpoint = `${routerBaseUrl}/api/v1/orders/cancel`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ order_code: orderCode, reason }),
  });

  return await response.json();
}

