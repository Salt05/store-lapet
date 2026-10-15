import type { APIRoute } from 'astro';
import { customerService } from '@/services/customer.service';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const { isAuthenticated, isDealer, partnerId, partnerName, partnerPhone } = locals.auth || {};
    const numericPartnerId = Number(partnerId);

    if (!isAuthenticated || !isDealer || !Number.isInteger(numericPartnerId) || numericPartnerId <= 0) {
      return new Response(
        JSON.stringify({ authenticated: false, isDealer: false, partner: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const partnerData = await customerService.getPartnerById(numericPartnerId);

    if (!partnerData) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          isDealer: false,
          partner: null,
          error: 'Không tìm thấy thông tin đại lý trên Odoo',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        isDealer: true,
        partner: {
          id: partnerData.id,
          name: partnerData.name || partnerName || '',
          ref: partnerData.ref || String(partnerData.id),
          phone: partnerData.phone || partnerPhone || '',
          email: partnerData.email || '',
          pricelist: partnerData.pricelist || 'Bảng giá chuẩn',
          shipping_address: partnerData.shipping_address || '',
          delivery_addresses: partnerData.delivery_addresses || [],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[API /api/customers/me Error]:', error);
    return new Response(
      JSON.stringify({
        authenticated: false,
        isDealer: false,
        partner: null,
        error: error?.message || 'Lỗi hệ thống khi lấy thông tin đại lý',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}