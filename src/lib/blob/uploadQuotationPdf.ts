import { put } from "@vercel/blob";

interface UploadQuotationPdfOptions {
  quotationId: string;
  quoteRef: string;
  buffer: Buffer;
}

function slugifyQuoteRef(value: string) {
  return String(value || "quotation")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function uploadQuotationPdfToBlob(opts: UploadQuotationPdfOptions) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN");
  }

  const pathname = `quotations/${opts.quotationId}/${slugifyQuoteRef(opts.quoteRef)}-${Date.now()}.pdf`;
  const blob = await put(pathname, opts.buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
    token,
  });

  return { url: blob.url, key: blob.pathname };
}
