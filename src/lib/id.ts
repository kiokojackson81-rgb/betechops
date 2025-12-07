export function generateRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateReceiptSerial(prefix = "R") {
  return `${prefix}-${generateRandomId()}`;
}
