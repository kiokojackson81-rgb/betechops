import { prisma } from "@/lib/prisma";
import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import renderReceiptHtml from "@/lib/receipts/renderReceiptHtml";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";

export async function buildReceiptPdfResponse(receiptId: string, opts?: { asDownload?: boolean; allowCached?: boolean; fileNamePrefix?: string }) {
  const asDownload = Boolean(opts?.asDownload);
  const allowCached = Boolean(opts?.allowCached);
  const fileNamePrefix = opts?.fileNamePrefix || "receipt";

  const files = !allowCached
    ? []
    : await prisma.receiptFile.findMany({
        where: { receiptId, contentType: "application/pdf", url: { not: "" } },
        orderBy: { uploadedAt: "desc" },
        take: 10,
      });

  const isFullCandidate = (file: { key: string | null; url: string }) => {
    const hay = `${String(file.key ?? "")} ${String(file.url ?? "")}`.toLowerCase();
    const looksCustomer = hay.includes("customer");
    const looksFull = hay.includes("print") || hay.includes("full");
    return looksFull && !looksCustomer;
  };

  const file = files.find(isFullCandidate) ?? files[0] ?? null;
  if (file?.url) {
    const upstream = await fetch(file.url, { redirect: "follow" });
    if (upstream.ok && upstream.body) {
      const headers = new Headers();
      headers.set("Content-Type", "application/pdf");
      headers.set("Cache-Control", "no-store");
      headers.set("Content-Disposition", `${asDownload ? "attachment" : "inline"}; filename="${fileNamePrefix}.pdf"`);
      const len = upstream.headers.get("content-length");
      if (len) headers.set("Content-Length", len);
      return new Response(upstream.body, { status: 200, headers });
    }
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
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
    return new Response(JSON.stringify({ error: "Receipt not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const snapshot = buildReceiptSnapshot(receipt);
  const html = await renderReceiptHtml(snapshot, { hideStamp: false });
  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", `${asDownload ? "attachment" : "inline"}; filename="${fileNamePrefix}.pdf"`);
    return new Response(pdf, { status: 200, headers });
  } finally {
    await browser.close().catch(() => undefined);
  }
}

