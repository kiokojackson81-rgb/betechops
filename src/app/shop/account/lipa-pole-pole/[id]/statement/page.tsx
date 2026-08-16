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

export default async function ShopLppStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    redirect("/login/phone?callbackUrl=/shop/account");
  }

  const { id } = await params;
  const detail = await getSerializedLppAccountDetail(id).catch(() => null);
  if (!detail || detail.account.customerId !== user.id) {
    redirect("/shop/account");
  }

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-[#7a0000]">Betech Solar Solutions</div>
            <h1 className="mt-2 text-3xl font-black">Lipa Pole Pole Statement</h1>
            <div className="mt-2 text-sm text-slate-600">{detail.account.reference}</div>
          </div>
          <button onClick={() => window.print()} className="rounded-full border px-4 py-2 text-sm font-semibold">
            Print
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-bold">Customer</div>
            <div className="mt-2 text-sm">{detail.account.customerName || "Customer"}</div>
            <div className="text-sm">{detail.account.customerPhone || ""}</div>
            <div className="text-sm">{detail.account.customerEmail || ""}</div>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-bold">Products</div>
            <div className="mt-2 space-y-1 text-sm">{detail.items.map((item) => <div key={item.id}>{item.quantity} × {item.description}</div>)}</div>
            <div className="text-sm">Due date: {formatDate(detail.account.expectedCompletionDate)}</div>
            <div className="text-sm">Status: {detail.account.status.replace(/_/g, " ")}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border p-4"><div className="text-xs uppercase text-slate-500">Total</div><div className="mt-1 font-black">{formatCurrency(detail.summary.agreedTotal)}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-xs uppercase text-slate-500">Paid</div><div className="mt-1 font-black">{formatCurrency(detail.summary.totalPaid)}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-xs uppercase text-slate-500">Balance</div><div className="mt-1 font-black">{formatCurrency(detail.summary.balance)}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-xs uppercase text-slate-500">Progress</div><div className="mt-1 font-black">{detail.summary.percentagePaid.toFixed(2)}%</div></div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {detail.payments.map((payment) => (
              <tr key={payment.id} className="border-b">
                <td className="px-3 py-2">{formatDate(payment.receivedAt)}</td>
                <td className="px-3 py-2">{payment.method}</td>
                <td className="px-3 py-2">{payment.reference || "-"}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(payment.amount)}</td>
                <td className="px-3 py-2">{payment.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
