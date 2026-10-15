// src/utils/cartPriceSync.ts

export async function syncCartPrices() {
  try {
    const rawCart = localStorage.getItem('cart');
    if (!rawCart) return;

    const cart = JSON.parse(rawCart);
    if (!Array.isArray(cart) || cart.length === 0) return;

    // 1. Kiểm tra trạng thái đăng nhập qua API /api/customers/me
    const meRes = await fetch('/api/customers/me', { credentials: 'include' });
    if (!meRes.ok) return; // Khách vãng lai, không cần đồng bộ giá đại lý

    const meData = await meRes.json();
    if (meData) {
      // Lưu lại thông tin đại lý vào localStorage để UI client nhận diện
      localStorage.setItem('user', JSON.stringify({ role: 'dealer', is_dealer: true, ...meData }));
    }

    // 2. Chuẩn bị danh sách sản phẩm để gọi API tính giá
    const items = cart.map((item: any) => ({
      id: item.odoo_id || item.id,
      qty: Number(item.quantity) || 1,
    }));

    // 3. Gọi API calculate-price (API sẽ tự đọc partner_id từ session)
    const priceRes = await fetch('/api/products/calculate-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items }),
    });

    if (!priceRes.ok) return;

    const priceData = await priceRes.json();
    const priceItems = priceData?.items || priceData; 

    if (!Array.isArray(priceItems)) return;

    // Tạo Map tra cứu giá theo ID
    const priceMap = new Map(
      priceItems.map((item: any) => [String(item.product_id || item.id), item])
    );

    // 4. Cập nhật lại giá mới vào Cart
    const updatedCart = cart.map((item: any) => {
      const lookupId = String(item.odoo_id || item.id);
      const serverItem = priceMap.get(lookupId);

      if (!serverItem) return item;

      const newPrice = Number(serverItem.price || serverItem.price_unit) || item.price;

      return {
        ...item,
        price: newPrice, // Giá đã áp dụng ưu đãi đại lý
        wholesale_price: newPrice,
      };
    });

    // 5. Lưu ngược lại localStorage và phát event báo cho toàn bộ UI
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  } catch (error) {
    console.error('[Cart Price Sync Error]:', error);
  }
}