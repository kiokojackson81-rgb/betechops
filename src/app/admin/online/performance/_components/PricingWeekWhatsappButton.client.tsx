"use client";

import { useState } from "react";
import { showToast } from "@/lib/ui/toast";

export default function PricingWeekWhatsappButton(props: {
  weekStart: string;
  defaultSent?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(Boolean(props.defaultSent));

  const onSend = async () => {
    if (sending || sent) return;
    try {
      setSending(true);
      const res = await fetch("/api/online/performance/send-pricing-week-whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekStart: props.weekStart, force: false }),
      });
      const body = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(String(body?.reason ?? body?.error ?? "Failed to send pricing WhatsApp"));
      }
      if (body?.status === "already_sent") {
        setSent(true);
        showToast("Pricing WhatsApp already sent for this week", "info");
        return;
      }
      setSent(true);
      showToast(`Pricing WhatsApp triggered for ${String(body?.summary?.reference ?? props.weekStart)}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send pricing WhatsApp", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onSend}
      disabled={sending || sent}
      className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {sending ? "Sending..." : sent ? "WhatsApp Sent" : "Send Pricing WhatsApp"}
    </button>
  );
}
