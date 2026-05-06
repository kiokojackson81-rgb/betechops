export function getLandingPage(attendantCategory?: string | null) {
  if (!attendantCategory) return "/";

  const cat = attendantCategory.toUpperCase();

  // Accept both the DB enum labels and legacy labels for robustness.
  switch (cat) {
    case "GENERAL":
      return "/";
    case "DIRECT_SALES":
    case "DIRECT_SALES_OPS":
      return "/marketing/tracker";
    case "JUMIA_OPERATIONS":
    case "JUMIA_KILIMALL_OPS":
    case "KILIMALL_OPERATIONS":
      return "/attendant/online";
    case "PRODUCT_UPLOAD":
    case "MARKETING_OPS":
      return "/attendant/daily-report";
    case "SUPPORT":
    case "SUPPORT_OPS":
      return "/attendant/support";
    case "BETECH_OPS":
      return "/attendant/general";
    case "GENERAL_OPS":
      return "/attendant/general";
    default:
      return "/";
  }
}

export const CATEGORY_LABELS = {
  GENERAL: "GENERAL",
  DIRECT_SALES: "DIRECT_SALES",
  JUMIA_OPERATIONS: "JUMIA_OPERATIONS",
  KILIMALL_OPERATIONS: "KILIMALL_OPERATIONS",
  PRODUCT_UPLOAD: "PRODUCT_UPLOAD",
  SUPPORT: "SUPPORT",
};
