// src/app/admin/_components/adminNav.ts
import { Package, Store, Receipt, FileText, Truck, Layers, Settings, BarChart3, LifeBuoy, WalletCards, HeartHandshake, Users } from "lucide-react";

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
      { href: "/admin/agents?view=pending", label: "Pending Approval" },
      { href: "/admin/agents?view=suspended", label: "Suspended" },
      { href: "/admin/agents?view=top", label: "Top Performers" },
      { href: "/admin/agents?view=fraud", label: "Fraud Alerts" },
      { href: "/admin/agents/pending-sales", label: "Sales Pipeline" },
      { href: "/admin/agents/pending-sales?queue=new", label: "New Submissions" },
      { href: "/admin/agents/pending-sales?queue=under_review", label: "Under Review" },
      { href: "/admin/agents/pending-sales?queue=payment_verified", label: "Payment Verified" },
      { href: "/admin/agents/pending-sales?queue=processing", label: "Delivery In Progress" },
      { href: "/admin/agents/pending-sales?queue=completed", label: "Completed Sales" },
      { href: "/admin/agents/pending-sales?queue=cancelled", label: "Cancelled / Rejected" },
      { href: "/admin/agents/commissions", label: "Locked Commissions" },
      { href: "/admin/agents/commissions?queue=pending", label: "Pending Commissions" },
      { href: "/admin/agents/commissions?queue=available", label: "Available for Withdrawal" },
      { href: "/admin/agents/commissions?queue=paid", label: "Paid Commissions" },
      { href: "/admin/agents/payouts", label: "Withdrawal Requests" },
      { href: "/admin/agents/payouts?queue=approved", label: "Approved Payouts" },
      { href: "/admin/agents/payouts?queue=paid", label: "Paid Payouts" },
      { href: "/admin/agents/payouts?queue=rejected", label: "Rejected Payouts" },
      { href: "/admin/agents/payouts?queue=held", label: "Held Payouts" },
      { href: "/admin/agents/fraud", label: "Duplicate Customers" },
      { href: "/admin/agents/fraud?queue=phone_reuse", label: "Phone Reuse" },
      { href: "/admin/agents/fraud?queue=suspicious_agents", label: "Suspicious Agents" },
      { href: "/admin/agents/fraud?queue=disputes", label: "Disputes" },
    ],
  },
  { href: "/admin/orders", label: "Orders", icon: Package },
  {
    href: "/admin/receipts",
    label: "POS Management",
    icon: WalletCards,
    children: [
      { href: "/admin/receipts", label: "Receipts" },
      { href: "/admin/pos-management", label: "Catalogue" },
      { href: "/admin/marketing-report?impersonateId=cmimxqf9t0003v5mcjdq8x61p", label: "SalesOps" },
      { href: "/admin/pending-pricing", label: "Pricing" },
      { href: "/admin/returns", label: "Returns" },
    ],
  },
  { href: "/admin/returns/jumia", label: "Jumia Returns", icon: Truck },
  { href: "/admin/catalog", label: "Catalog", icon: Layers },
  { href: "/admin/marketing-report", label: "Marketing report", icon: BarChart3 },
  { href: "/admin/support-report", label: "Support report", icon: LifeBuoy },
  { href: "/admin/wellness", label: "Wellness", icon: HeartHandshake },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
