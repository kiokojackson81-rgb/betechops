import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  })}`;

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
};

type PageParams = {
  source?: string;
  id?: string;
};

export default async function ReceiptHistoryDetailPage({ params }: { params: Promise<PageParams> | PageParams }) {
  let resolvedParams = params;
  if (resolvedParams && typeof (resolvedParams as Promise<PageParams>).then === "function") {
    resolvedParams = await (resolvedParams as Promise<PageParams>);
  }

  const source = String((resolvedParams as PageParams)?.source ?? "").trim().toLowerCase();
  const id = String((resolvedParams as PageParams)?.id ?? "").trim();

  if (!id || (source !== "marketing" && source !== "support")) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-500/30 bg-slate-900/80 p-6">
          <h1 className="text-2xl font-semibold text-white">Receipt details unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">The receipt link is invalid or incomplete.</p>
        </div>
      </div>
    );
  }

  const receipt =
    source === "marketing"
      ? await prisma.marketingReceipt.findUnique({
          where: { id },
          include: {
            items: true,
            dailyEntry: {
              include: {
                submittedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        })
      : await prisma.supportReceipt.findUnique({
          where: { id },
          include: {
            items: true,
            dailyEntry: {
              include: {
                submittedBy: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

  if (!receipt) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-500/30 bg-slate-900/80 p-6">
          <h1 className="text-2xl font-semibold text-white">Receipt not found</h1>
          <p className="mt-2 text-sm text-slate-300">This receipt no longer exists or the id is wrong.</p>
        </div>
      </div>
    );
  }

  const title = source === "marketing" ? "Marketing receipt details" : "Support receipt details";
  const submittedBy =
    receipt.dailyEntry?.submittedBy?.name ??
    ("submittedByName" in receipt.dailyEntry ? receipt.dailyEntry.submittedByName : null) ??
    null;

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">{source}</p>
            <h1 className="text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-2 text-sm text-slate-300">
              Read-only receipt details for {receipt.receiptNumber ?? receipt.id}.
            </p>
          </div>
          <Link
            href="/attendant/daily-report#my-receipts"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            Back to daily report
          </Link>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/30">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipt number</p>
              <p className="mt-2 text-lg font-semibold text-white">{receipt.receiptNumber ?? receipt.id}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total sales</p>
              <p className="mt-2 text-lg font-semibold text-emerald-300">{formatKES(receipt.sellingTotal)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Created</p>
              <p className="mt-2 text-sm text-slate-100">{formatDateTime(receipt.createdAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Payment method</p>
              <p className="mt-2 text-sm text-slate-100">{String(receipt.paymentMethod ?? "-")}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Attendant</p>
              <p className="mt-2 text-sm text-slate-100">{submittedBy ?? "Attendant unknown"}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products</p>
              <p className="mt-2 text-sm text-slate-100">{receipt.items.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipt items</p>
              <h2 className="text-xl font-semibold text-white">Products in this receipt</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {receipt.items.length === 0 ? (
              <p className="text-sm text-slate-400">No product lines were saved for this receipt.</p>
            ) : (
              receipt.items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.productName || `Product ${index + 1}`}</p>
                    <p className="text-xs text-slate-400">Item {index + 1}</p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Included in receipt total</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
