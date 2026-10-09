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

async function extractTrackingNumbers(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) {
    if (!client) throw new Error("Image import is unavailable because OCR is not configured. Upload the Speedaf Excel or CSV export instead.");
    const image = `data:${file.type};base64,${buffer.toString("base64")}`;
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0,
      messages: [
        { role: "system", content: "Extract only Speedaf Kenya tracking numbers from this payment sheet. A valid number is KE followed by exactly 18 digits. Return one tracking number per line. Do not return dates, amounts, settlement references, or any uncertain value." },
        { role: "user", content: [{ type: "image_url", image_url: { url: image, detail: "high" } }] },
      ],
    });
    return trackingNumbersIn(response.choices[0]?.message?.content);
  }
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const parsed = Papa.parse<string[]>(buffer.toString("utf8"), { skipEmptyLines: true });
    return trackingNumbersIn((parsed.data ?? []).flat().join("\n"));
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return trackingNumbersIn(workbook.SheetNames.flatMap((sheet) => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: false }).flat()).join("\n"));
  }
  throw new Error("Upload a Speedaf payment image, CSV, XLSX, or XLS file.");
}

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a Speedaf payment file to import." }, { status: 400 });

  try {
    const trackingNumbers = await extractTrackingNumbers(file);
    if (!trackingNumbers.length) return NextResponse.json({ error: "No valid Speedaf tracking numbers were found. Check that each number starts with KE and has 18 digits after it." }, { status: 400 });

    const receipts = await prisma.receipt.findMany({
      where: { data: { path: ["podDelivery"], not: Prisma.JsonNull } },
      select: { id: true, data: true },
    });
    const receivedAt = new Date().toISOString();
    const actorId = String((auth.session?.user as { id?: string } | undefined)?.id ?? "").trim() || null;
    const matched = new Set<string>();
    let markedPaid = 0;

    for (const receipt of receipts) {
      const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? { ...(receipt.data as Record<string, unknown>) } : null;
      const pod = data?.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery) ? { ...(data.podDelivery as Record<string, unknown>) } : null;
      if (!data || !pod || String(pod.status ?? "").toLowerCase() !== "delivered") continue;
      const receiptTracking = Array.isArray(pod.trackingNumbers) ? pod.trackingNumbers.flatMap(trackingNumbersIn) : trackingNumbersIn(pod.trackingNumbers);
      const matching = receiptTracking.filter((tracking) => trackingNumbers.includes(tracking));
      if (!matching.length) continue;
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
        },
      };
      await prisma.receipt.update({ where: { id: receipt.id }, data: { data: data as Prisma.InputJsonValue } });
      markedPaid += 1;
    }

    return NextResponse.json({ ok: true, found: trackingNumbers.length, markedPaid, alreadyPaid: matched.size - markedPaid, unmatchedTrackingNumbers: trackingNumbers.filter((tracking) => !matched.has(tracking)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import the Speedaf settlement file." }, { status: 400 });
  }
}
