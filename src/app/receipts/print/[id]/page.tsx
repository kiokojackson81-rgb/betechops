import renderReceiptTemplate from "@/app/templates/receiptTemplate";
import { getBranding } from "@/lib/branding";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import ReceiptToolbar from "./ReceiptToolbar";
import PrintOnLoad from "./PrintOnLoad";
import Link from "next/link";
import { waitForReceiptById } from "@/lib/receiptReadAfterWrite";

export const dynamic = "force-dynamic";

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
  const autoPrintRaw = resolvedSearchParams?.autoPrint;
  const autoPrint = Array.isArray(autoPrintRaw) ? autoPrintRaw[0] : autoPrintRaw;

  const receipt = await waitForReceiptById({
    receiptId: id,
    loggerPrefix: "[receipts print page]",
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
    console.error("[receipts print page] receipt not found after retries", { id });
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Receipt not confirmed</h1>
        <p className="mt-3 text-slate-600">
          This receipt cannot be printed because no saved record was found. Return to the receipts desk and search its reference before creating another one.
        </p>
        <Link className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 font-medium text-white" href="/receipts">
          Return to receipts
        </Link>
      </main>
    );
  }

  const snapshot = buildReceiptSnapshot(receipt);
  const branding = await getBranding();
  // buildReceiptSnapshot returns a typed object; cast to `any` so we can spread it
  // and inject `branding` without a type error during the Next.js build.
  const html = renderReceiptTemplate(
    { ...(snapshot as any), branding },
    { hideStamp: false, hideItemWarrantySummary: true }
  );
  const printableHtml = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "");

  // Render the template HTML directly into the page so it behaves like the printable route.
  return (
    <div className="receipt-preview-host bg-slate-200">
      <PrintOnLoad enabled={autoPrint === "1"} />
      {autoPrint !== "1" ? (
        <div className="mx-auto w-full max-w-[148mm] px-4 pt-4">
          <ReceiptToolbar receiptId={id} />
        </div>
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: printableHtml }} />
    </div>
  );
}
