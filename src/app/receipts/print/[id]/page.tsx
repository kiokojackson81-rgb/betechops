import { prisma } from "@/lib/prisma";
import renderReceiptTemplate from "@/app/templates/receiptTemplate";
import { getBranding } from "@/lib/branding";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import ReceiptToolbar from "./ReceiptToolbar";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?:
    | { [key: string]: string | string[] | undefined }
    | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let resolvedParams: { id: string } | null =
    params && typeof (params as Promise<{ id: string }>).then === "function"
      ? null
      : (params as { id: string });
  if (!resolvedParams && params && typeof (params as Promise<{ id: string }>).then === "function") {
    try {
      resolvedParams = await params;
    } catch (error) {
      console.error("[receipts print page] failed to resolve params", { error });
      resolvedParams = { id: "" };
    }
  }

  const id = resolvedParams?.id;
  if (!id) {
    console.error("[receipts print page] missing params.id", { params: resolvedParams ?? params ?? null });
    return <div>Invalid receipt identifier</div>;
  }

  const resolvedSearchParams =
    searchParams && typeof (searchParams as Promise<{ [key: string]: string | string[] | undefined }>).then === "function"
      ? await (searchParams as Promise<{ [key: string]: string | string[] | undefined }>)
      : (searchParams as { [key: string]: string | string[] | undefined } | undefined);
  const fallbackDraftRaw = resolvedSearchParams?.draft;
  const fallbackDraft = Array.isArray(fallbackDraftRaw) ? fallbackDraftRaw[0] : fallbackDraftRaw;
  const autoPrintRaw = resolvedSearchParams?.autoPrint;
  const autoPrint = Array.isArray(autoPrintRaw) ? autoPrintRaw[0] : autoPrintRaw;

  let receipt: any = null;
  for (const delayMs of [0, 150, 350, 700]) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    receipt = await prisma.receipt.findUnique({
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
    if (receipt) break;
  }

  if (!receipt) {
    if (fallbackDraft) {
      const params = new URLSearchParams({ draft: fallbackDraft });
      if (autoPrint === "1") params.set("autoPrint", "1");
      redirect(`/receipts/preview?${params.toString()}`);
    }
    console.error("[receipts print page] receipt not found after retries", { id });
    return <div>Receipt not found</div>;
  }

  const snapshot = buildReceiptSnapshot(receipt);
  const branding = await getBranding();
  // buildReceiptSnapshot returns a typed object; cast to `any` so we can spread it
  // and inject `branding` without a type error during the Next.js build.
  const html = renderReceiptTemplate(
    { ...(snapshot as any), branding },
    { hideStamp: false, hideItemWarrantySummary: true }
  );

  // Render the template HTML directly into the page so it behaves like the printable route.
  return (
    <div>
      <ReceiptToolbar receiptId={id} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
