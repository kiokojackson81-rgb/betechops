import { prisma } from "@/lib/prisma";
import EditDayClient from "@/app/admin/marketing-report/EditDayClient";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditDayPage(props: any) {
  // server-side guard: only ADMIN may access this page
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return redirect("/not-authorized");

  const { entryId } = props.params as { entryId: string };
  const entry = await prisma.marketingDailyEntry.findUnique({
    where: { id: entryId },
    include: { receipts: { include: { items: true } } },
  });
  if (!entry) return notFound();

  // serialize minimal data for client
  const payload = {
    id: entry.id,
    date: entry.date.toISOString(),
    receipts: entry.receipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      sellingTotal: r.sellingTotal,
      paymentMethod: r.paymentMethod,
      items: r.items.map((it) => ({ id: it.id, productName: it.productName, buyingPrice: it.buyingPrice })),
    })),
  };

  return (
    <div className="mx-auto max-w-4xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Edit marketing entry — {entry.date.toISOString().split("T")[0]}</h1>
      <EditDayClient initialData={payload} />
    </div>
  );
}
