import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminCustomerContext } from "@/lib/adminCustomerContext";
import { parseAdminCustomerProfileLookup } from "@/lib/adminCustomerProfileLinks";

export const dynamic = "force-dynamic";

function splitList(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatStatus(value: string | null | undefined) {
  return String(value || "Quotation")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metricCard(label: string, value: string) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function toneClass(tone: "voice" | "sales" | "account" | "support" | "chatrace") {
  if (tone === "voice") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
  if (tone === "sales") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  if (tone === "account") return "border-violet-400/20 bg-violet-400/10 text-violet-100";
  if (tone === "support") return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  return "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100";
}

export default async function AdminCustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ lookup: string }>;
  searchParams?: Promise<{
    userId?: string;
    phones?: string;
    emails?: string;
    name?: string;
  }>;
}) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");

  const route = await params;
  const query = (await searchParams) || {};
  const lookup = parseAdminCustomerProfileLookup(route.lookup);

  const context = await getAdminCustomerContext({
    customerUserId: query.userId || (lookup.kind === "user" ? lookup.value : null),
    displayName: query.name || null,
    phones: [...splitList(query.phones), ...(lookup.kind === "phone" ? [lookup.value] : [])],
    emails: [...splitList(query.emails), ...(lookup.kind === "email" ? [lookup.value] : [])],
  });

  const backQuery = new URLSearchParams();
  if (context.profile.phones[0]) backQuery.set("q", context.profile.phones[0]);
  else if (context.profile.emails[0]) backQuery.set("q", context.profile.emails[0]);
  else if (context.profile.displayName) backQuery.set("q", context.profile.displayName);
  const backHref = `/admin/customers${backQuery.toString() ? `?${backQuery.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.95),rgba(2,6,23,.98))] p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Customer Profile</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{context.profile.displayName}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {context.profile.location || "No location recorded"} · Customer since {formatDateTime(context.profile.customerSince)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={backHref}
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20"
            >
              Back to customer desk
            </Link>
            {context.quickLinks.lastCallHref ? (
              <Link
                href={context.quickLinks.lastCallHref}
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35"
              >
                Open last call
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCard("Total purchases", formatMoney(context.sales.totalPurchasesValue))}
        {metricCard("Voice calls", String(context.voice.totalCalls))}
        {metricCard("Lipa Pole Pole balance", formatMoney(context.lipaPolePole.outstandingBalance))}
        {metricCard("Portal", context.account.hasPortalAccess ? "Active" : "Pending")}
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Contact</div>
            <div className="mt-4 space-y-2 text-sm text-slate-200">
              <div>Phones: {context.profile.phones.join(", ") || "None"}</div>
              <div>Emails: {context.profile.emails.join(", ") || "None"}</div>
              <div>Town: {context.profile.town || "—"}</div>
              <div>County: {context.profile.county || "—"}</div>
              <div>Estate / landmark: {context.profile.estateLandmark || "—"}</div>
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Voice summary</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {metricCard("Answered", String(context.voice.answeredCalls))}
              {metricCard("Missed", String(context.voice.missedCalls))}
              {metricCard("Attempted", String(context.voice.attemptedCalls))}
              {metricCard("Callback requests", String(context.voice.callbackRequests))}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Quick links</div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {context.quickLinks.voiceHistoryHref ? <Link href={context.quickLinks.voiceHistoryHref} className="rounded-full border border-white/10 px-3 py-2 text-slate-200 transition hover:border-white/20 hover:text-white">Voice history</Link> : null}
              {context.quickLinks.receiptDeskHref ? <Link href={context.quickLinks.receiptDeskHref} className="rounded-full border border-white/10 px-3 py-2 text-slate-200 transition hover:border-white/20 hover:text-white">Receipts desk</Link> : null}
              {context.quickLinks.quotationHref ? <Link href={context.quickLinks.quotationHref} className="rounded-full border border-white/10 px-3 py-2 text-slate-200 transition hover:border-white/20 hover:text-white">Quotations</Link> : null}
              {context.quickLinks.webOrdersHref ? <Link href={context.quickLinks.webOrdersHref} className="rounded-full border border-white/10 px-3 py-2 text-slate-200 transition hover:border-white/20 hover:text-white">Web orders</Link> : null}
              {context.quickLinks.lipaPolePoleHref ? <Link href={context.quickLinks.lipaPolePoleHref} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-amber-100 transition hover:border-amber-300/35">Lipa Pole Pole</Link> : null}
              {context.quickLinks.chatraceInboxHref ? <a href={context.quickLinks.chatraceInboxHref} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-2 text-slate-200 transition hover:border-white/20 hover:text-white">Chatrace inbox</a> : null}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sales snapshot</div>
              <div className="text-xs text-slate-500">Last purchase {formatDateTime(context.sales.lastPurchaseAt)}</div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricCard("Open quotations", String(context.sales.openQuotations))}
              {metricCard("Pending web orders", String(context.sales.pendingWebOrders))}
              {metricCard("Pending POD", String(context.sales.pendingPod))}
              {metricCard("Portal sign-in", context.account.lastLoginMethod || "Not recorded")}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Lipa Pole Pole accounts</div>
              <div className="text-xs text-slate-500">{context.lipaPolePole.activeAccounts} active · {context.lipaPolePole.totalAccounts} total</div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {metricCard("Agreed value", formatMoney(context.lipaPolePole.agreedTotal))}
              {metricCard("Total paid", formatMoney(context.lipaPolePole.totalPaid))}
              {metricCard("Outstanding", formatMoney(context.lipaPolePole.outstandingBalance))}
            </div>
            <div className="mt-4 space-y-3">
              {context.lipaPolePole.accounts.length ? context.lipaPolePole.accounts.map((account) => (
                <div key={account.id} className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-white">{account.reference} · {account.productName || "Product booking"}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatStatus(account.status)} · Paid {formatMoney(account.totalPaid)} · Balance {formatMoney(account.balance)}</div>
                  </div>
                  <Link href={account.href} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300/35">Open LPP</Link>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">No Lipa Pole Pole accounts linked to this customer.</div>}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent quotations</div>
              <div className="text-xs text-slate-500">{context.recentQuotations.length} visible</div>
            </div>
            <div className="mt-4 space-y-3">
              {context.recentQuotations.length ? (
                context.recentQuotations.map((quotation) => (
                  <div key={quotation.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-white">{quotation.quoteRef}</div>
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                            {formatStatus(quotation.status)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          {quotation.quoteTitle || "Quotation proposal"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>{quotation.itemCount} items</span>
                          <span>{formatMoney(quotation.totalAmount)}</span>
                          <span>Updated {formatDateTime(quotation.updatedAt)}</span>
                          {quotation.customerActionAt ? <span>Viewed {formatDateTime(quotation.customerActionAt)}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={quotation.href} className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white">
                          Open quotation
                        </Link>
                        <a href={quotation.pdfHref} className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/35">
                          Download PDF
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">
                  No quotation records linked to this customer yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cross-system timeline</div>
              <div className="text-xs text-slate-500">{context.timeline.length} recent events</div>
            </div>
            <div className="mt-4 space-y-3">
              {context.timeline.length ? (
                context.timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass(item.tone)}`}>
                            {item.tone}
                          </span>
                          <div className="font-semibold text-white">{item.title}</div>
                        </div>
                        <div className="mt-2 text-sm text-slate-300">{item.detail}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500">{formatDateTime(item.at)}</div>
                        {item.href ? (
                          item.href.startsWith("http") ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                            >
                              Open
                            </a>
                          ) : (
                            <Link
                              href={item.href}
                              className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                            >
                              Open
                            </Link>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-slate-500">
                  No cross-system history found for this customer yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
