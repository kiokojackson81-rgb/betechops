// src/app/admin/_components/adminNav.ts
import { Package, Store, Receipt, FileText, Truck, Layers, Settings, BarChart3, LifeBuoy, WalletCards, HeartHandshake, Users, PhoneCall } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: Array<{
    href: string;
    label: string;
  }>;
};

export const NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: Receipt },
  { href: "/admin/attendants", label: "Staffs", icon: Store },
  {
    href: "/admin/agents",
    label: "Agents",
    icon: Users,
    children: [
      { href: "/admin/agents", label: "All Agents" },
      { href: "/admin/agents/pending-sales", label: "Sales" },
      { href: "/admin/agents/commissions", label: "Commissions" },
      { href: "/admin/agents/payouts", label: "Payouts" },
      { href: "/admin/agents/fraud", label: "Fraud & Risk" },
    ],
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: Package,
    children: [
      { href: "/admin/orders", label: "Jumia Orders" },
    ],
  },
  {
    href: "/admin/receipts",
    label: "Receipts",
    icon: WalletCards,
    children: [
      { href: "/admin/receipts", label: "Receipts" },
      { href: "/admin/pos-management", label: "Catalogue" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/settings/shop-images", label: "Shop Images" },
      { href: "/admin/marketing-report?impersonateId=cmimxqf9t0003v5mcjdq8x61p", label: "SalesOps" },
      { href: "/admin/reviews-referrals", label: "Customer Reviews" },
      { href: "/admin/returns", label: "Projects" },
      { href: "/admin/receipts?tab=website-orders", label: "Website Orders" },
      { href: "/admin/quotation-center", label: "Quotation Center" },
      { href: "/admin/quotation-center/site-visits", label: "Site Visits" },
    ],
  },
  { href: "/admin/online/summary", label: "Jumia Activities", icon: Truck },
  {
    href: "/admin/communications/voice",
    label: "Voice Calls",
    icon: PhoneCall,
    children: [
      { href: "/admin/communications/voice", label: "Operations Center" },
      { href: "/admin/communications/voice/settings", label: "Softphone Settings" },
    ],
  },
  { href: "/admin/catalog", label: "Catalog", icon: Layers },
  { href: "/admin/marketing-report", label: "Marketing report", icon: BarChart3 },
  { href: "/admin/support-report", label: "Support report", icon: LifeBuoy },
  { href: "/admin/wellness", label: "Wellness", icon: HeartHandshake },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
