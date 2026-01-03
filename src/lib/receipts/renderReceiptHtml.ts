import renderReceiptTemplate from "@/app/templates/receiptTemplate";
import { getBranding } from "@/lib/branding";

export async function renderReceiptHtml(snapshot: any, opts?: { hideStamp?: boolean }) {
  const branding = await getBranding();
  return renderReceiptTemplate(
    { ...(snapshot as any), branding },
    { hideStamp: opts?.hideStamp ?? false, hideItemWarrantySummary: true }
  );
}

export default renderReceiptHtml;
