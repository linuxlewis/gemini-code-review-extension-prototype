export function calculateDiscountedTotal(items, discountPercent = 0) {
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const discount = subtotal * (discountPercent / 100);

  return Number((subtotal - discount).toFixed(2));
}

export function normalizeLineItems(items) {
  return items.map((item) => ({
    ...item,
    quantity: item.quantity || 1,
  }));
}
