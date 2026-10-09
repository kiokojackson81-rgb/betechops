import { NextResponse } from "next/server";
import OpenAI from "openai";
import Papa from "papaparse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const trackingPattern = /^KE\d{18}$/;

const trackingNumbersIn = (value: unknown) =>
  [...new Set(String(value ?? "").toUpperCase().match(/K\s*E(?:[\s:.-]*\d){18}/g)?.map((match) => match.replace(/[^A-Z0-9]/g, "")).filter((match) => trackingPattern.test(match)) ?? [])];

async function extractPaymentSheetText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) {
    if (!client) throw new Error("Image import is unavailable because OCR is not configured. Upload the Speedaf Excel or CSV export instead.");
    const image = `data:${file.type};base64,${buffer.toString("base64")}`;
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0,
      messages: [
        { role: "system", content: "Transcribe the visible rows of this Speedaf payment sheet exactly enough to preserve customer names and KE tracking numbers. A valid tracking number is KE followed by exactly 18 digits. Return plain text only; do not invent missing values." },
        { role: "user", content: [{ type: "image_url", image_url: { url: image, detail: "high" } }] },
      ],
    });
    return String(response.choices[0]?.message?.content ?? "");
  }
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const parsed = Papa.parse<string[]>(buffer.toString("utf8"), { skipEmptyLines: true });
    return (parsed.data ?? []).flat().join("\n");
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return workbook.SheetNames.flatMap((sheet) => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: false }).flat()).join("\n");
  }
  throw new Error("Upload a Speedaf payment image, CSV, XLSX, or XLS file.");
}

const nameTokens = (value: unknown) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((token) => token.length >= 2);

// A name fallback is deliberately conservative: all meaningful name tokens
// must occur in the imported payment sheet. Tracking-number matches always win.
const customerNameMatchesSheet = (customerName: unknown, sheetText: string) => {
  const tokens = nameTokens(customerName);
  const sheetTokens = new Set(nameTokens(sheetText));
  return tokens.length >= 2 && tokens.every((token) => sheetTokens.has(token));
};

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a Speedaf payment file to import." }, { status: 400 });

  try {
    const sheetText = await extractPaymentSheetText(file);
    const trackingNumbers = trackingNumbersIn(sheetText);
    if (!sheetText.trim()) return NextResponse.json({ error: "No readable payment details were found in this file." }, { status: 400 });

    const receipts = await prisma.receipt.findMany({
      where: { data: { path: ["podDelivery"], not: Prisma.JsonNull } },
      select: { id: true, data: true, order: { select: { customerName: true } } },
    });
    const receivedAt = new Date().toISOString();
    const actorId = String((auth.session?.user as { id?: string } | undefined)?.id ?? "").trim() || null;
    const matched = new Set<string>();
    let markedPaid = 0;
    let matchedByName = 0;

    for (const receipt of receipts) {
      const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? { ...(receipt.data as Record<string, unknown>) } : null;
      const pod = data?.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery) ? { ...(data.podDelivery as Record<string, unknown>) } : null;
      if (!data || !pod || String(pod.status ?? "").toLowerCase() !== "delivered") continue;
      const receiptTracking = Array.isArray(pod.trackingNumbers) ? pod.trackingNumbers.flatMap(trackingNumbersIn) : trackingNumbersIn(pod.trackingNumbers);
      const matching = receiptTracking.filter((tracking) => trackingNumbers.includes(tracking));
      const matchedByCustomerName = !matching.length && customerNameMatchesSheet(receipt.order?.customerName, sheetText);
      if (!matching.length && !matchedByCustomerName) continue;
      matching.forEach((tracking) => matched.add(tracking));
      if ((pod.speedafSettlement as Record<string, unknown> | undefined)?.status === "paid") continue;
      data.podDelivery = {
        ...pod,
        speedafSettlement: {
          status: "paid",
          settledAt: receivedAt,
          settledById: actorId,
          sourceFileName: file.name,
          trackingNumbers: matching,
          matchedBy: matching.length ? "tracking_number" : "customer_name",
        },
      };
      await prisma.receipt.update({ where: { id: receipt.id }, data: { data: data as Prisma.InputJsonValue } });
      markedPaid += 1;
      if (matchedByCustomerName) matchedByName += 1;
    }

    return NextResponse.json({ ok: true, found: trackingNumbers.length, markedPaid, matchedByName, alreadyPaid: Math.max(0, matched.size - markedPaid), unmatchedTrackingNumbers: trackingNumbers.filter((tracking) => !matched.has(tracking)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import the Speedaf settlement file." }, { status: 400 });
  }
}
