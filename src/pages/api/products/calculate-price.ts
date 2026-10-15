// src/pages/api/products/calculate-price.ts

import type { APIRoute } from 'astro';
import { productService } from '@/services/product.service';

export const prerender = false;

export const POST: APIRoute = async ({
  request,
  locals,
}) => {
  try {
    const {
      isAuthenticated,
      isDealer,
      partnerId,
    } = locals.auth || {};

    const numericPartnerId =
      Number(partnerId);

    /* =========================================================
     * AUTH
     * ========================================================= */

    if (
      !isAuthenticated ||
      !isDealer ||
      !Number.isInteger(numericPartnerId) ||
      numericPartnerId <= 0
    ) {
      return new Response(
        JSON.stringify({
          error:
            'Chưa đăng nhập hoặc không có quyền đại lý',
        }),
        {
          status: 401,
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    /* =========================================================
     * BODY
     * ========================================================= */

    const body =
      await request.json();

    const { items } = body;

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return new Response(
        JSON.stringify({
          items: [],
          subtotal: 0,
          discount_amount: 0,
          vat_amount: 0,
          total: 0,

          appliedPromotions: {
            fixedPricePromos: [],
            categoryTierPromos: [],
          },

          proposedPromotions: {
            categoryTierPromos: [],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    /* =========================================================
     * SERVER CALCULATION
     * ========================================================= */

    const priceDetails =
      await productService.calculatePricelistForCart(
        numericPartnerId,
        items
      );

    return new Response(
      JSON.stringify({
        items:
          priceDetails.items || [],

        subtotal:
          Number(
            priceDetails.subtotal || 0
          ),

        discount_amount:
          Number(
            priceDetails.discount_amount || 0
          ),

        vat_amount:
          Number(
            priceDetails.vat_amount || 0
          ),

        total:
          Number(
            priceDetails.total || 0
          ),

        appliedPromotions:
          priceDetails.appliedPromotions || {
            fixedPricePromos: [],
            categoryTierPromos: [],
          },

        proposedPromotions:
          priceDetails.proposedPromotions || {
            categoryTierPromos: [],
          },
      }),
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error(
      'Lỗi API tính giá + khuyến mãi:',
      error
    );

    const message =
      error?.message ||
      'Không thể tính giá giỏ hàng.';

    /*
     * Các lỗi dữ liệu sản phẩm/cart.
     */
    const isProductDataError =
      message.includes(
        'không tồn tại'
      ) ||
      message.includes(
        'đã bị xóa'
      ) ||
      message.includes(
        'không thể bán'
      ) ||
      message.includes(
        'chưa được liên kết'
      ) ||
      message.includes(
        'chưa có SKU'
      ) ||
      message.includes(
        'không hợp lệ'
      ) ||
      message.includes(
        'Không xác định được sản phẩm'
      );

    /*
     * Lỗi hệ thống bên ngoài:
     * Odoo / Directus.
     */
    const isInfrastructureError =
      message.includes(
        'kết nối hệ thống'
      );

    let status = 500;

    if (isProductDataError) {
      status = 422;
    } else if (isInfrastructureError) {
      status = 503;
    }

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status,
        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );
  }
};