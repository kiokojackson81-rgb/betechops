export type GenericReceiptNotificationEligibilityInput = {
  customerType?: string | null;
  source?: string | null;
  suppressGenericCustomerNotifications?: boolean;
};

function normalizeValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function shouldUseGenericReceiptNotifications(
  input: GenericReceiptNotificationEligibilityInput,
): boolean {
  if (input.suppressGenericCustomerNotifications === true) return false;
  if (normalizeValue(input.source) === "projectcompletion") return false;
  if (normalizeValue(input.customerType) === "project") return false;
  return true;
}
