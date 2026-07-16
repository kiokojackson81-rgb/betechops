"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

type InvitationRow = {
  id: string;
  customerUserId: string | null;
  customerName: string;
  customerPhoneRaw: string;
  customerPhone: string;
  customerEmail: string | null;
  productName: string;
  reviewStatus: string;
  scheduledSendAt: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  sendAttempts: number;
  lastSendAttemptAt: string | null;
  lastSendStatus: string | null;
  lastSendError: string | null;
  websiteOrderId: string | null;
  orderId: string | null;
  receiptId: string | null;
  orderOrReceiptRef: string | null;
};

type ChannelTestResult = {
  channel: "sms" | "whatsapp" | "email";
  recipient: string;
  reviewUrl: string;
  preview: {
    title: string;
    subject?: string;
    message: string;
  };
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function badgeClass(status: string) {
  if (status === "sent") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "failed") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (status === "due") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function deriveQueue(row: InvitationRow) {
  if (row.sentAt) return "sent";
  if ((row.lastSendStatus || "").toUpperCase() === "FAILED") return "failed";
  return "due";
}

function buildVoiceHistoryHref(phone: string) {
  const params = new URLSearchParams();
  params.set("tab", "recent");
  params.set("selectedPhone", phone);
  return `/admin/communications/voice?${params.toString()}`;
}

export default function ReviewInvitationsAdminClient({
  initialRows,
  initialFilter = "all",
}: {
  initialRows: InvitationRow[];
  initialFilter?: "all" | "due" | "sent" | "failed";
}) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<"all" | "due" | "sent" | "failed">(initialFilter);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testBusyKey, setTestBusyKey] = useState<string | null>(null);
  const [channelTests, setChannelTests] = useState<Record<string, ChannelTestResult | undefined>>({});

  const filteredRows = useMemo(
    () => rows.filter((row) => filter === "all" || deriveQueue(row) === filter),
    [rows, filter],
  );

  async function retrySend(id: string) {
    setBusyId(id);
    const response = await fetch(`/api/admin/reviews-referrals/invitations/${id}/retry`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      invitation?: InvitationRow | null;
      error?: string;
    };
    setBusyId(null);
    if (!response.ok || !payload.ok || !payload.invitation) {
      window.alert(payload.error || "Unable to retry invitation send.");
      return;
    }
    setRows((current) => current.map((row) => (row.id === id ? payload.invitation! : row)));
  }

  async function sendChannelTest(id: string, channel: "sms" | "whatsapp" | "email") {
    const busyKey = `${id}:${channel}`;
    setTestBusyKey(busyKey);
    const response = await fetch(`/api/admin/reviews-referrals/invitations/${id}/channel-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    } & Partial<ChannelTestResult>;
    setTestBusyKey(null);
    if (!response.ok || !payload.ok || !payload.channel || !payload.preview || !payload.recipient || !payload.reviewUrl) {
      window.alert(payload.error || "Unable to send test message.");
      return;
    }
    setChannelTests((current) => ({
      ...current,
      [id]: payload as ChannelTestResult,
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "due", "failed", "sent"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              filter === option
                ? "bg-cyan-300 text-slate-950"
                : "border border-white/10 bg-slate-950/60 text-slate-200"
            }`}
          >
            {option === "all" ? "All" : option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {!filteredRows.length ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          <div className="text-lg font-semibold text-white">No invitations in this queue.</div>
        </div>
      ) : null}

      {filteredRows.map((row) => {
        const queue = deriveQueue(row);
        const customerProfileHref = buildAdminCustomerProfileHref({
          customerUserId: row.customerUserId,
          phone: row.customerPhoneRaw,
          email: row.customerEmail,
          displayName: row.customerName,
        });
        const voiceHistoryHref = buildVoiceHistoryHref(row.customerPhoneRaw);
        return (
          <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">{row.customerName}</h2>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClass(queue)}`}>
                    {queue}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${String(row.reviewStatus || "").toUpperCase() === "SUBMITTED" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                    {String(row.reviewStatus || "").toUpperCase() === "SUBMITTED" ? "review submitted" : "awaiting review"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                  <div>Product: {row.productName}</div>
                  <div>Phone: {row.customerPhone}</div>
                  <div>Order/receipt: {row.orderOrReceiptRef || "Not linked"}</div>
                  <div>Review status: {row.reviewStatus}</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Attempts</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-white">{row.sendAttempts}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Scheduled</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.scheduledSendAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last attempt</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.lastSendAttemptAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Sent at</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.sentAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Expires</div>
                <div className="mt-2 text-sm font-medium text-slate-100">{formatDate(row.expiresAt)}</div>
              </div>
            </div>

            {row.lastSendError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {row.lastSendError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => retrySend(row.id)}
                disabled={busyId !== null || queue === "sent"}
                className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {busyId === row.id ? "Sending..." : queue === "sent" ? "Already sent" : queue === "failed" ? "Retry send" : "Send invitation"}
              </button>
              <button
                onClick={() => sendChannelTest(row.id, "sms")}
                disabled={testBusyKey !== null}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {testBusyKey === `${row.id}:sms` ? "Testing SMS..." : "Test SMS"}
              </button>
              <button
                onClick={() => sendChannelTest(row.id, "whatsapp")}
                disabled={testBusyKey !== null}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 disabled:opacity-60"
              >
                {testBusyKey === `${row.id}:whatsapp` ? "Testing WhatsApp..." : "Test WhatsApp"}
              </button>
              <button
                onClick={() => sendChannelTest(row.id, "email")}
                disabled={testBusyKey !== null}
                className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:opacity-60"
              >
                {testBusyKey === `${row.id}:email` ? "Testing Email..." : "Test Email"}
              </button>
              <Link
                href={customerProfileHref}
                className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/30"
              >
                Open Customer 360
              </Link>
              <Link
                href={voiceHistoryHref}
                className="rounded-2xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:border-violet-300/30"
              >
                Open voice history
              </Link>
            </div>

            {channelTests[row.id] ? (
              <div className="mt-4 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">Admin test preview</div>
                    <div className="mt-1 text-lg font-semibold text-white">{channelTests[row.id]!.preview.title}</div>
                  </div>
                  <div className="text-sm text-cyan-50">
                    Sent to: {channelTests[row.id]!.recipient}
                  </div>
                </div>
                {channelTests[row.id]!.preview.subject ? (
                  <div className="mt-4 text-sm text-cyan-50">
                    Subject: {channelTests[row.id]!.preview.subject}
                  </div>
                ) : null}
                <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-7 text-slate-100">
                  {channelTests[row.id]!.preview.message}
                </div>
                <div className="mt-3 text-sm text-cyan-50">
                  Review link: {channelTests[row.id]!.reviewUrl}
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
