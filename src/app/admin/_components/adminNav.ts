// src/app/admin/_components/adminNav.ts
import { Package, Store, Receipt, FileText, Truck, Layers, Settings, BarChart3, LifeBuoy, HeartHandshake } from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: Receipt },
  { href: "/admin/attendants", label: "Staffs", icon: Store },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/receipts", label: "Receipts", icon: FileText },
  { href: "/admin/marketing-report?impersonateId=cmimxqf9t0003v5mcjdq8x61p", label: "SalesOps", icon: Truck },
  { href: "/admin/returns/jumia", label: "Jumia Returns", icon: Truck },
  { href: "/admin/catalog", label: "Catalog", icon: Layers },
  { href: "/admin/marketing-report", label: "Marketing report", icon: BarChart3 },
  { href: "/admin/support-report", label: "Support report", icon: LifeBuoy },
  { href: "/admin/wellness", label: "Wellness", icon: HeartHandshake },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
