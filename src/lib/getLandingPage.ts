import type { AttendantCategory } from "@prisma/client";

export default function getLandingPage(category?: AttendantCategory, role?: string) {
  if (role === "ADMIN") return "/admin";
  switch (category) {
    case "DIRECT_SALES_OPS":
      return "/marketing/tracker";
    case "MARKETING_OPS":
      return "/attendant/daily-report";
    case "SUPPORT_OPS":
      return "/support/dashboard";
    case "JUMIA_KILIMALL_OPS":
    case "BETECH_OPS":
    default:
      return "/attendant";
  }
}
