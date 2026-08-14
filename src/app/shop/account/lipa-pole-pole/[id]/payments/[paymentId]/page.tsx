import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace("KES", "KSh");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ShopLppAcknowledgementPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    redirect("/login/phone?callbackUrl=/shop/account");
  }

  const { id, paymentId } = await params;
  const detail = await getSerializedLppAccountDetail(id).catch(() => null);
  if (!detail || detail.account.customerId !== user.id) {
    redirect("/shop/account");
  }
  const payment = detail.payments.find((entry) => entry.id === paymentId);
  if (!payment) {
    redirect(`/shop/account/lipa-pole-pole/${encodeURIComponent(id)}`);
  }

  const orderedPayments = [...detail.payments]
    .filter((entry) => entry.status === "SUCCESS" && !entry.reversedAt)
    .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
  const paymentIndex = orderedPayments.findIndex((entry) => entry.id === payment.id);
  const previousPaid = orderedPayments
    .slice(0, Math.max(0, paymentIndex))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalPaid = previousPaid + payment.amount;
  const balance = Math.max(0, detail.summary.agreedTotal - totalPaid);

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Betech Solar Solutions</div>
            <h1 className="mt-2 text-3xl font-black">Lipa Pole Pole Payment Acknowledgement</h1>
            <div className="mt-2 text-sm text-slate-600">{detail.account.reference}</div>
          </div>
          <button onClick={() => window.print()} className="rounded-full border px-4 py-2 text-sm font-semibold">
            Print
          </button>
        </div>

        <div className="mt-6 rounded-2xl border p-5">
          <div className="grid gap-2 text-sm">
            <div><span className="font-bold">Product:</span> {detail.account.productName || "Reserved product"}</div>
            <div><span className="font-bold">Agreed Price:</span> {formatCurrency(detail.summary.agreedTotal)}</div>
            <div><span className="font-bold">Previous Paid:</span> {formatCurrency(previousPaid)}</div>
            <div><span className="font-bold">Payment Received:</span> {formatCurrency(payment.amount)}</div>
            <div><span className="font-bold">Total Paid:</span> {formatCurrency(totalPaid)}</div>
            <div><span className="font-bold">Remaining Balance:</span> {formatCurrency(balance)}</div>
            <div><span className="font-bold">Progress:</span> {detail.summary.agreedTotal > 0 ? ((totalPaid / detail.summary.agreedTotal) * 100).toFixed(2) : "0.00"}%</div>
            <div><span className="font-bold">Payment Method:</span> {payment.method}</div>
            <div><span className="font-bold">Reference:</span> {payment.reference || "-"}</div>
            <div><span className="font-bold">Date:</span> {formatDate(payment.receivedAt)}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-slate-700">
          Product status: NOT YET AVAILABLE FOR COLLECTION. Product will be released only after full payment and final conversion.
        </div>
      </div>
    </main>
  );
}
