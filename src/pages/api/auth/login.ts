import type { APIRoute } from 'astro';
import { customerService } from '@/services/customer.service';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, session }) => {
  try {
    const body = await request.json();
    const { phone_or_email } = body;

    if (!phone_or_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Vui lòng nhập Email hoặc Số điện thoại',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Tìm đại lý từ Odoo
    const partner = await customerService.findPartnerByPhoneOrEmail(phone_or_email);

    if (!partner) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Không tìm thấy tài khoản đại lý trong hệ thống',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Lưu Astro Session
    if (session) {
      await session.regenerate();
      await session.set('partner_id', partner.id);
      await session.set('partner_name', partner.name ?? null);
      await session.set('partner_email', partner.email ?? null);
      await session.set('partner_phone', partner.phone ?? partner.mobile ?? null);
    }

    const cookieOptions = {
      path: '/',
      httpOnly: false,
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
    };

    // Cookie xác định trạng thái đăng nhập
    cookies.set('partner_id', String(partner.id), cookieOptions);
    cookies.set('partner_name', String(partner.name || ''), cookieOptions);
    cookies.set('partner_phone', String(partner.phone || partner.mobile || ''), cookieOptions);

    cookies.set(
      'session_id',
      String(partner.session_id || `partner_session_${partner.id}`),
      { ...cookieOptions, httpOnly: true }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đăng nhập thành công',
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          phone: partner.phone,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Lỗi hệ thống khi xử lý đăng nhập',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};