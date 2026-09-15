export function buildAdminCustomerPortalLoginHref(input: {
  customerUserId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  callbackUrl?: string;
}) {
  const params = new URLSearchParams();
  if (input.customerUserId) params.set("userId", input.customerUserId);
  if (input.customerName) params.set("name", input.customerName);
  if (input.customerPhone) params.set("phone", input.customerPhone);
  if (input.customerEmail) params.set("email", input.customerEmail);
  params.set("callbackUrl", input.callbackUrl || "/account");
  return `/api/admin/customers/portal-login?${params.toString()}`;
}
