import { normalizeCategory } from "@/lib/attendants/categoryCompat";

export function getLandingPage(category?: string | null, role?: string): string {
  const cat = normalizeCategory(category);

  if (role === "ADMIN") {
    if (cat === "JUMIA_KILIMALL_OPS" || cat === "BETECH_OPS" || cat === "GENERAL_OPS") {
      return "/admin/online/summary";
    }
    return "/admin";
  }

  if (!cat) return "/attendant";

  switch (cat) {
    case "DIRECT_SALES_OPS":
      return "/marketing/tracker";
    case "MARKETING_OPS":
      return "/attendant/daily-report";
    case "JUMIA_KILIMALL_OPS":
      return "/attendant/online";
    case "SUPPORT_OPS":
      return "/attendant/support";
    case "GENERAL_OPS":
    case "BETECH_OPS":
      return "/attendant/general";
    default:
      return "/attendant";
  }
}

export function getAdminLandingPage(category?: string | null): string {
  const cat = normalizeCategory(category);
  if (!cat) return "/admin";

  switch (cat) {
    case "DIRECT_SALES_OPS":
      return "/admin/marketing-report";
    case "MARKETING_OPS":
      return "/admin/daily-report";
    case "JUMIA_KILIMALL_OPS":
      return "/admin/online/summary";
    case "SUPPORT_OPS":
      return "/admin/support-report";
    case "GENERAL_OPS":
    case "BETECH_OPS":
      return "/admin/online/summary";
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
    case "GENERAL_OPS":
      return "General User Ops";
    case "BETECH_OPS":
      return "Betech Ops (Legacy)";
    default:
      return "Unassigned";
  }
}

export default getLandingPage;
