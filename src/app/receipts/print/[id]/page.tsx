import { prisma } from "@/lib/prisma";
import renderReceiptTemplate from "@/app/templates/receiptTemplate";
import { getBranding } from "@/lib/branding";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import ReceiptToolbar from "./ReceiptToolbar";

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

  const snapshot = buildReceiptSnapshot(receipt);
  const branding = await getBranding();
  // buildReceiptSnapshot returns a typed object; cast to `any` so we can spread it
  // and inject `branding` without a type error during the Next.js build.
  const html = renderReceiptTemplate({ ...(snapshot as any), branding }, { hideStamp: false });

  // Render the template HTML directly into the page so it behaves like the printable route.
  return (
    <div>
      <ReceiptToolbar receiptId={id} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
