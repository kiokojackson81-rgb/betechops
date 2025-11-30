import type { AttendantCategory } from "@prisma/client";

export default function getLandingPage(category?: AttendantCategory, role?: string) {
  if (role === "ADMIN") return "/admin";
  switch (category) {
    case ("DIRECT_SALES_OPS" as any):
      return "/marketing/tracker";
    case ("MARKETING_OPS" as any):
      return "/attendant/daily-report";
    case ("SUPPORT_OPS" as any):
      return "/support/dashboard";
    case ("JUMIA_KILIMALL_OPS" as any):
    case ("BETECH_OPS" as any):
    default:
      return "/attendant";
  }
}
