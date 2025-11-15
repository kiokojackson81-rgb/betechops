// src/app/admin/_components/adminNav.ts
import { Package, Store, Receipt, FileText, Truck, Layers, Settings } from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: Receipt },
  { href: "/admin/shops", label: "Shops & Staff", icon: Store },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/returns", label: "Returns", icon: Truck },
  { href: "/admin/returns/jumia", label: "Jumia Returns", icon: Truck },
  { href: "/admin/catalog", label: "Catalog", icon: Layers },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
