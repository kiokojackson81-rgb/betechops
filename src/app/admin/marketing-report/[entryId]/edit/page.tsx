import EditDayClient from "@/app/admin/marketing-report/EditDayClient";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type EditDayPageProps = {
  params: { entryId: string };
};

export default async function EditDayPage({ params }: EditDayPageProps) {
  // server-side guard: only ADMIN may access this page
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN") return redirect("/not-authorized");

  const entry = await prisma.marketingDailyEntry.findUnique({
    where: { id: params.entryId },
    include: { receipts: { include: { items: true } } },
  });
  if (!entry) return notFound();

  const payload = {
    id: entry.id,
    date: entry.date.toISOString(),
    receipts: entry.receipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber ?? "",
      sellingTotal: Number(r.sellingTotal) || 0,
      paymentMethod: r.paymentMethod,
      items: r.items.map((it) => ({
        id: it.id,
        productName: it.productName || "",
        buyingPrice: Number(it.buyingPrice) || 0,
      })),
    })),
  };

  const formattedDate = entry.date.toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-4xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Edit marketing entry - {formattedDate}</h1>
      <EditDayClient initialData={payload} />
    </div>
  );
}
