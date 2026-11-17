// src/pages/api/admin/configs/index.ts
import type { APIRoute } from 'astro';
import { configService } from '@/services/config.service';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const baseDiscount = await configService.getBaseDiscountPercent();
    const longtermPolicy = await configService.getLongtermPolicy();
    const integrations = await configService.getIntegrationsConfig();
    const allConfigs = await configService.getAllConfigs();

    const companyInfo = allConfigs.get('company_info') || {
      company_name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LA PET',
      tax_id: '0318123456',
      address: 'Số 123 Đường D2, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh',
      hotline: '0909 203 166',
      email: 'contact@lapet.vn',
      website: 'https://lapet.vn',
      representative_name: 'Nguyễn Văn Phát',
      representative_title: 'Giám Đốc Điều Hành',
    };

    const notificationConfig = allConfigs.get('notification_config') || {
      admin_email: 'admin@lapet.vn',
      notify_on_dealer_register: true,
      notify_on_new_order: true,
    };

    const vietqrConfig = allConfigs.get('vietqr_config') || {};
    const vnpayConfig = allConfigs.get('vnpay_config') || {
      url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      tmn_code: process.env.VNPAY_TMN_CODE || 'BPFUA1FN',
      hash_secret: process.env.VNPAY_HASH_SECRET ? '••••••••••••••••••••••••••••••••' : '',
      return_url: process.env.VNPAY_RETURN_URL || 'http://localhost:4321/api/payment/vnpay-callback',
    };

    const smtpConfig = allConfigs.get('smtp_config') || {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      password: '',
      sender_name: 'LA PET B2B Notification System',
      sender_email: '',
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          baseDiscount,
          longtermPolicy,
          categoryPolicies: [],
          promotions: [],
          integrations,
          companyInfo,
          notificationConfig,
          vietqrConfig,
          vnpayConfig,
          smtpConfig,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, key, value } = body;

    // 1. Cập nhật system config
    if (action === 'save_system_config') {
      await configService.saveConfig(key, value);
      configService.invalidateCache();
      return new Response(
        JSON.stringify({ success: true, message: `Đã lưu cấu hình [${key}]` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1.1 Lưu cấu hình kết nối Odoo / Directus / Router
    if (action === 'save_integrations') {
      await configService.saveIntegrationsConfig(value);
      configService.invalidateCache();
      return new Response(
        JSON.stringify({ success: true, message: 'Đã lưu cấu hình kết nối hệ thống thành công!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1.1b Lưu thông tin pháp nhân công ty & email liên hệ hiển thị
    if (action === 'save_company_info') {
      await configService.saveConfig('company_info', value, 'Thông tin pháp nhân công ty cho hóa đơn & liên hệ website');
      configService.invalidateCache();
      return new Response(
        JSON.stringify({ success: true, message: 'Đã lưu thông tin pháp nhân công ty thành công!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1.1c Lưu cấu hình email Admin nhận thông báo
    if (action === 'save_notification_config') {
      await configService.saveConfig('notification_config', value, 'Cấu hình hòm thư nhận thông báo nội bộ cho Quản trị viên');
      configService.invalidateCache();
      return new Response(
        JSON.stringify({ success: true, message: 'Đã lưu cấu hình Email Nhận Thông Báo Quản Trị thành công!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1.1d Lưu cấu hình VNPAY
    if (action === 'save_vnpay_config') {
      await configService.saveConfig('vnpay_config', value, 'Cấu hình cổng thanh toán VNPAY');
      configService.invalidateCache();
      return new Response(
        JSON.stringify({ success: true, message: 'Đã lưu cấu hình cổng VNPAY thành công!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1.1e Lưu cấu hình SMTP gửi mail
    if (action === 'save_smtp_config') {
      await configService.saveConfig('smtp_config', value, 'Cấu hình SMTP máy chủ gửi mail thông báo');
      configService.invalidateCache();
      return new Response(
        JSON.stringify({ success: true, message: 'Đã lưu cấu hình máy chủ SMTP thành công!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1.1f Test gửi mail SMTP thực tế qua email-otp-service
    if (action === 'test_smtp') {
      const emailOtpUrl = (process.env.EMAIL_OTP_SERVICE_URL || 'http://localhost:4000').replace(/\/+$/, '');
      const targetEmail = body.target_email || '';

      try {
        const res = await fetch(`${emailOtpUrl}/api/test-smtp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_email: targetEmail }),
        });
        const resJson = await res.json();
        return new Response(
          JSON.stringify(resJson),
          { status: res.status, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Không thể kết nối email-otp-service tại ${emailOtpUrl}: ${e.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1.2 Test kết nối các dịch vụ khác
    if (action === 'test_connection') {
      const { service, config: svcConfig } = body;
      if (service === 'directus') {
        const result = await configService.testDirectusConnection(svcConfig);
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (service === 'router') {
        const result = await configService.testRouterConnection(svcConfig?.url || '');
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (service === 'emailOtp') {
        const result = await configService.testEmailOtpConnection(svcConfig?.url || '');
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: 'Dịch vụ không xác định' }), { status: 400 });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Thao tác không hợp lệ' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
