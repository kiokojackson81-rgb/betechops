"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ReviewRow = {
  id: string;
  invitationId: string;
  customerName: string;
  customerPhoneRaw: string;
  customerPhone: string;
  customerTown: string | null;
  productId: string;
  productName: string;
  productUrl: string;
  reviewTitle: string | null;
  reviewBody: string;
  overallRating: number;
  wouldRecommend: string | null;
  published: boolean;
  publishedAt: string | null;
  moderationStatus: string;
  hasProblem: boolean;
  websiteOrderId: string | null;
  orderId: string | null;
  receiptId: string | null;
  orderOrReceiptRef: string | null;
  orderUrl: string | null;
  createdAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ReviewsAdminListClient({
  initialRows,
}: {
  initialRows: ReviewRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      }),
    [rows],
  );

  async function updatePublished(rowId: string, published: boolean) {
    const busy = `${rowId}:${published ? "publish" : "unpublish"}`;
    setBusyKey(busy);
    const response = await fetch(`/api/admin/reviews-referrals/reviews/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusyKey(null);
    if (!response.ok || !payload.ok) {
      window.alert(payload.error || "Unable to update review publication.");
      return;
    }
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              published,
              moderationStatus: published ? "published" : "pending",
              publishedAt: published ? new Date().toISOString() : null,
            }
          : row,
      ),
    );
    router.refresh();
  }

  async function deleteReview(rowId: string) {
    const confirmed = window.confirm("Delete this review? This will remove the submission from admin review queues.");
    if (!confirmed) return;
    setBusyKey(`${rowId}:delete`);
    const response = await fetch(`/api/admin/reviews-referrals/reviews/${rowId}`, {
      method: "DELETE",
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusyKey(null);
    if (!response.ok || !payload.ok) {
      window.alert(payload.error || "Unable to delete review.");
      return;
    }
    setRows((current) => current.filter((row) => row.id !== rowId));
    router.refresh();
  }

  return (
    <>
      {!sortedRows.length ? null : sortedRows.map((row) => (
        <article key={row.id} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold text-white">{row.customerName}</h2>
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  row.published
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                }`}>
                  {row.published ? "published" : row.moderationStatus}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  Product:{" "}
                  <a href={row.productUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
                    {row.productName}
                  </a>
                </div>
                <div>Phone: {row.customerPhoneRaw || row.customerPhone}</div>
                <div>
                  Order/receipt:{" "}
                  {row.orderUrl ? (
                    <Link href={row.orderUrl} target="_blank" className="text-cyan-300 hover:text-cyan-200">
                      {row.orderOrReceiptRef || "Open details"}
                    </Link>
                  ) : (
                    row.orderOrReceiptRef || "Not linked"
                  )}
                </div>
                <div>Submitted: {formatDate(row.createdAt)}</div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Overall rating</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-white">{row.overallRating}/5</div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Review title</div>
            <div className="mt-2 text-lg font-semibold text-white">{row.reviewTitle || "Customer review submitted"}</div>
            <div className="mt-4 text-sm leading-7 text-slate-300">{row.reviewBody}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Recommend: {row.wouldRecommend || "Not specified"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Published: {row.published ? "Yes" : "No"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Customer town: {row.customerTown || "Not provided"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Problem reported: {row.hasProblem ? "Yes" : "No"}</div>
            {row.publishedAt ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">Published at: {formatDate(row.publishedAt)}</div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => updatePublished(row.id, !row.published)}
              disabled={busyKey === `${row.id}:${row.published ? "unpublish" : "publish"}`}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                row.published
                  ? "border border-amber-400/20 bg-amber-400/10 text-amber-100 hover:border-amber-300/40"
                  : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/40"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {busyKey === `${row.id}:${row.published ? "unpublish" : "publish"}`
                ? "Saving..."
                : row.published
                  ? "Unpublish review"
                  : "Publish review"}
            </button>
            <button
              type="button"
              onClick={() => deleteReview(row.id)}
              disabled={busyKey === `${row.id}:delete`}
              className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:border-rose-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyKey === `${row.id}:delete` ? "Deleting..." : "Delete review"}
            </button>
          </div>
        </article>
      ))}
    </>
  );
}
