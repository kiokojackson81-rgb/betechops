export function getLandingPage(category?: string | null, role?: string): string {
  if (role === "ADMIN") return "/admin";

  if (!category) return "/attendant";

  // Normalize the incoming category string to a DB-friendly enum label.
  // Accept many legacy formats (spaces, hyphens, mixed case) by
  // converting to upper-case and replacing non-alphanumerics with underscores.
  const cat = (category || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

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
