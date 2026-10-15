export function addToCart(product) {
  let cart = getCart();

  // Ép kiểu odoo_id bắt buộc từ Directus
  const odooId = parseInt(product.odoo_id, 10);

  if (isNaN(odooId) || !odooId) {
    console.error("Sản phẩm thiếu odoo_id từ Directus:", product);
    alert("Sản phẩm này chưa có mã Odoo ID hợp lệ!");
    return;
  }

  // So sánh theo odoo_id
  let existingItem = cart.find(item => Number(item.odoo_id) === odooId);

  if (existingItem) {
    existingItem.quantity = Number(existingItem.quantity || 1) + 1;
  } else {
    cart.push({
      id: product.id,                 // ID Directus (dùng cho frontend/slug)
      odoo_id: odooId,                // ID Odoo chuẩn dạng Integer (gửi API Odoo)
      sku: product.sku || '',
      name: product.name,             // Trường `name` từ Directus
      price: Number(product.price || 0),
      image: product.image || '',
      quantity: 1
    });
  }

  saveCart(cart);
  window.dispatchEvent(new CustomEvent('open-cart'));
}