const RECEIPT_EDIT_WINDOW_MS = 12 * 60 * 60 * 1000;

export function isReceiptWithinEditableWindow(createdAt: Date | string | null | undefined) {
  if (!createdAt) return false;
  const createdAtDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) return false;
  return Date.now() - createdAtDate.getTime() <= RECEIPT_EDIT_WINDOW_MS;
}

export function canEditReceiptByRole(input: {
  role?: string | null;
  createdAt: Date | string | null | undefined;
  canView: boolean;
  readOnly?: boolean;
}) {
  if (!input.canView || input.readOnly) return false;
  if (String(input.role || "").toUpperCase() === "ADMIN") return true;
  return isReceiptWithinEditableWindow(input.createdAt);
}

export function receiptEditRestrictionMessage() {
  return "Only admin can edit this receipt after 12 hours.";
}
