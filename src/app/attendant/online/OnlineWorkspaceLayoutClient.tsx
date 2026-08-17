"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import OnlineOperationsShell from "./OnlineOperationsShell";

type Identity = {
  name: string;
  email: string;
  role: string;
  isSupervisor: boolean;
};

const initialIdentity: Identity = {
  name: "Online attendant",
  email: "Account loading...",
  role: "Online Attendant",
  isSupervisor: false,
};

function pageHeading(pathname: string, mode: "online" | "general") {
  if (pathname.includes("/lipa-pole-pole")) {
    return ["Lipa Pole Pole", "Manage bookings, payments, follow-ups, statements, and customer activity."];
  }
  if (pathname.includes("/performance/capture")) {
    return ["Capture Buying Price", "Record buying prices and transaction details without leaving the operations workspace."];
  }
  if (pathname.includes("/performance/week")) {
    return ["Weekly Performance", "Review captured marketplace entries and loss records for the selected week."];
  }
  if (pathname.endsWith("/performance")) {
    return ["Performance", "Review marketplace performance by trading week."];
  }
  if (pathname.includes("/manual-weekly")) {
    return ["Manual Weekly", "Upload and manage weekly marketplace totals."];
  }
  if (pathname.includes("/pos-pricing")) {
    return ["POS Pricing", "Review and complete the supervisor pricing queue."];
  }
  if (pathname.includes("/receipts")) {
    return ["Receipts Workspace", "Create receipts and review POS history in one place."];
  }
  if (pathname.includes("/wellness")) {
    return ["Wellness Center", "Manage leave, cash support, and employee wellness requests."];
  }
  return mode === "general"
    ? ["General Operations Dashboard", "Direct sales, POS receipts, commissions, and payroll."]
    : ["Online Operations Dashboard", "Marketplace performance, POS receipts, commissions, and payroll."];
}

export default function OnlineWorkspaceLayoutClient({
  children,
  mode = "online",
}: {
  children: ReactNode;
  mode?: "online" | "general";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonateId")?.trim() || "";
  const [identity, setIdentity] = useState<Identity>(initialIdentity);

  useEffect(() => {
    const params = new URLSearchParams();
    if (impersonateId) {
      params.set("impersonateId", impersonateId);
      params.set("scope", "mine");
    }
    const query = params.toString();

    void fetch(`/api/attendants/me${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json().catch(() => null);
        return body?.data ?? body;
      })
      .then((payload) => {
        if (!payload?.user) return;
        const role = String(payload.user.role ?? "ONLINE_ATTENDANT").replace(/_/g, " ");
        setIdentity({
          name: String(payload.user.name ?? payload.user.email ?? "Online attendant"),
          email: String(payload.user.email ?? ""),
          role: payload?.flags?.supervisorPerformanceTools ? "Online Supervisor" : role,
          isSupervisor: Boolean(payload?.flags?.supervisorPerformanceTools),
        });
      })
      .catch(() => undefined);
  }, [impersonateId]);

  const withImpersonation = (path: string) => {
    if (!impersonateId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}impersonateId=${encodeURIComponent(impersonateId)}`;
  };
  const dashboardHref = withImpersonation(mode === "general" ? "/attendant/general" : "/attendant/online");
  const receiptsHref = withImpersonation(mode === "general" ? "/receipts" : "/attendant/online/receipts?view=history");
  const createReceiptHref = withImpersonation(mode === "general" ? "/receipts" : "/attendant/online/receipts?view=create");
  const wellnessHref = withImpersonation(mode === "general" ? "/attendant/wellness" : "/attendant/online/wellness");
  const reportParams = new URLSearchParams();
  if (impersonateId) reportParams.set("impersonateId", impersonateId);
  const reportQuery = reportParams.toString();
  const reportHref = `/api/attendant/daily-report/performance-receipt/pdf${reportQuery ? `?${reportQuery}` : ""}`;
  const payslipHref = `/api/attendant/payslip${reportQuery ? `?${reportQuery}` : ""}`;
  const [dashboardTitle, dashboardDescription] = pageHeading(pathname, mode);

  return (
    <OnlineOperationsShell
      userName={identity.name}
      userEmail={identity.email}
      roleLabel={identity.role}
      dashboardTitle={dashboardTitle}
      dashboardDescription={dashboardDescription}
      workspaceLabel={mode === "general" ? "General Operations" : "Online Operations"}
      dashboardHref={dashboardHref}
      receiptsHref={receiptsHref}
      createReceiptHref={createReceiptHref}
      reportHref={reportHref}
      payslipHref={payslipHref}
      wellnessHref={wellnessHref}
      activePath={pathname}
      receiptView={searchParams.get("view") ?? "history"}
      isSupervisor={identity.isSupervisor}
      pricingOpen={pathname.includes("/pos-pricing")}
      onOpenLipaPolePole={() => router.push(withImpersonation("/attendant/online/lipa-pole-pole"))}
      onOpenPerformance={() => router.push(withImpersonation("/attendant/online/performance"))}
      onOpenProfitCapture={() => router.push(withImpersonation("/attendant/online/performance/capture"))}
      onOpenManualWeekly={() => router.push(withImpersonation("/attendant/online/manual-weekly"))}
      onTogglePricing={() => router.push(withImpersonation("/attendant/online/pos-pricing"))}
      onLogout={() => void signOut({ callbackUrl: "/" })}
    >
      {children}
    </OnlineOperationsShell>
  );
}
