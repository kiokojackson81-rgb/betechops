import { put } from "@vercel/blob";

interface UploadReceiptPdfOptions {
  receiptId: string;
  kind: "customer" | "print";
  buffer: Buffer;
}

export async function uploadReceiptPdfToBlob(opts: UploadReceiptPdfOptions) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN");
  }

  const pathname = `receipts/${opts.receiptId}/${opts.kind}.pdf`;
  const blob = await put(pathname, opts.buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
    token,
  });

  return { url: blob.url, key: blob.pathname };
}
