import { prisma } from "@/lib/prisma";
import renderReceiptTemplate from "@/app/templates/receiptTemplate";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          attendant: { select: { id: true, name: true } },
          layawayPlan: { include: { payments: true } },
        },
      },
      issuedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!receipt) {
    return <div>Receipt not found</div>;
  }

  const order = receipt.order || {};
  const items = (order.items || []).map((it: any) => ({
    title: it.product?.name || it.title || it.productName || "",
    quantity: it.quantity ?? 1,
    unitPrice: it.sellingPrice ?? it.unitPrice ?? 0,
    serial: it.serial ?? "",
    warranty: it.warranty ?? "",
  }));

  const snapshot: any = {
    order,
    items,
    totals: receipt.totals ?? order.totals ?? {},
    notes: receipt.notes ?? (receipt.data && receipt.data.notes) ?? "",
    generatedAt: receipt.generatedAt ? receipt.generatedAt.toISOString() : new Date().toISOString(),
    customerName: order.customerName || "",
    attendantName: receipt.issuedBy?.name || order?.attendant?.name || "",
    paymentMethod: (receipt.data && receipt.data.paymentMethod) || receipt.paymentMethod || "",
    deliveryAddress: (order.metadata && order.metadata.deliveryAddress) || (receipt.data && receipt.data.deliveryAddress) || "",
  };

  const html = renderReceiptTemplate(snapshot, { hideStamp: false });

  // Render the template HTML directly into the page so it behaves like the printable route.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
