const normalizeCategory = (category?: string | null) =>
  (category || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function getLandingPage(category?: string | null, role?: string): string {
  if (role === "ADMIN") return "/admin";

  if (!category) return "/attendant";

  const cat = normalizeCategory(category);

  switch (cat) {
    case "DIRECT_SALES":
    case "DIRECT_SALES_OPS":
      return "/marketing/tracker";
    case "PRODUCT_UPLOAD":
    case "MARKETING_OPS":
      return "/attendant/daily-report";
    case "JUMIA_OPERATIONS":
    case "JUMIA_KILIMALL_OPS":
      return "/attendant";
    case "SUPPORT":
    case "SUPPORT_OPS":
      return "/attendant/support";
    case "BETECH_OPS":
      return "/admin";
    default:
      return "/attendant";
  }
}

export function getAdminLandingPage(category?: string | null, role?: string): string {
  if (role === "ADMIN") return "/admin";

  if (!category) return "/admin";

  const cat = normalizeCategory(category);

  switch (cat) {
    case "DIRECT_SALES":
    case "DIRECT_SALES_OPS":
      return "/admin/marketing-report";
    case "PRODUCT_UPLOAD":
    case "MARKETING_OPS":
      return "/admin/daily-report";
    case "JUMIA_OPERATIONS":
    case "JUMIA_KILIMALL_OPS":
      return "/admin/jumia-console";
    case "SUPPORT":
    case "SUPPORT_OPS":
      return "/admin/support-report";
    case "BETECH_OPS":
      return "/admin";
    default:
      return "/admin";
  }
}

export function getCategoryLabel(category?: string | null) {
  switch (category) {
    case "DIRECT_SALES_OPS":
      return "Direct Sales Ops";
    case "MARKETING_OPS":
      return "Marketing Ops";
    case "JUMIA_KILIMALL_OPS":
      return "Jumia / Kilimall Ops";
    case "SUPPORT_OPS":
      return "Support Ops";
    case "BETECH_OPS":
      return "Betech Ops (Supervisor)";
    default:
      return "Unassigned";
  }
}

export default getLandingPage;
