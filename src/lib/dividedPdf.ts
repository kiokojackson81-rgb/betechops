import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  computeDividedValues,
  type DividedReportPayload,
  DIVIDED_FIXED_DEDUCTION,
  DIVIDED_RATE_PCT,
} from "@/lib/dividedReport";

function formatKes(n: number) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

async function loadLetterheadJpg() {
  try {
    const filePath = path.join(process.cwd(), "public", "letterhead.jpg");
    const buf = await readFile(filePath);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function buildDividedPdfBuffer(report: DividedReportPayload) {
  const metrics = computeDividedValues(report);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let cursorY = height - 28;
  const marginX = 36;
  const letterheadJpg = await loadLetterheadJpg();

  if (letterheadJpg) {
    try {
      const img = await pdf.embedJpg(letterheadJpg);
      const targetW = width - marginX * 2;
      const scale = targetW / img.width;
      const targetH = img.height * scale;
      page.drawImage(img, { x: marginX, y: cursorY - targetH, width: targetW, height: targetH });
      cursorY = cursorY - targetH - 16;
    } catch {
      // ignore image failures
    }
  }

  page.drawText("Divided summary", {
    x: marginX,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: rgb(0.05, 0.09, 0.17),
  });
  cursorY -= 18;
  page.drawText(`Week: ${report.week.weekStartInput} - ${report.week.weekEndInput}`, {
    x: marginX,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.29, 0.35, 0.45),
  });
  cursorY -= 18;

  const col = {
    account: marginX,
    sales: width - marginX - 220,
    returns: width - marginX - 160,
    gross: width - marginX - 100,
    profit: width - marginX - 40,
  };

  const headerY = cursorY;
  page.drawLine({
    start: { x: marginX, y: headerY - 6 },
    end: { x: width - marginX, y: headerY - 6 },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.94),
  });
  page.drawText("Account", { x: col.account, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Sales", { x: col.sales, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Returns", { x: col.returns, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Gross", { x: col.gross, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  page.drawText("Profit", { x: col.profit, y: headerY, size: 9, font: fontBold, color: rgb(0.39, 0.45, 0.55) });
  cursorY -= 20;

  const rowH = 16;
  for (const account of report.accounts) {
    page.drawText(String(account.label ?? ""), {
      x: col.account,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: rgb(0.05, 0.09, 0.17),
    });
    page.drawText(formatKes(Number(account.salesNetPayout ?? 0)), {
      x: col.sales,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.05, 0.45, 0.34),
    });
    page.drawText(formatKes(Number(account.returns ?? 0)), {
      x: col.returns,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.05, 0.09, 0.17),
    });
    page.drawText(formatKes(Number(account.grossProfit ?? 0)), {
      x: col.gross,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.05, 0.09, 0.17),
    });
    page.drawText(formatKes(Number(account.profit ?? 0)), {
      x: col.profit,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.05, 0.09, 0.17),
    });
    cursorY -= rowH;
  }

  cursorY -= 4;
  page.drawLine({
    start: { x: marginX, y: cursorY + 10 },
    end: { x: width - marginX, y: cursorY + 10 },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.94),
  });
  page.drawText("Totals", { x: col.account, y: cursorY, size: 10, font: fontBold, color: rgb(0.05, 0.09, 0.17) });
  page.drawText(formatKes(Number(report.totals.sales ?? 0)), {
    x: col.sales,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: rgb(0.05, 0.45, 0.34),
  });
  page.drawText(formatKes(Number(report.totals.returns ?? 0)), {
    x: col.returns,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.05, 0.09, 0.17),
  });
  page.drawText(formatKes(Number(report.totals.grossProfit ?? 0)), {
    x: col.gross,
    y: cursorY,
    size: 10,
    font,
    color: rgb(0.05, 0.09, 0.17),
  });
  page.drawText(formatKes(Number(report.totals.profit ?? 0)), {
    x: col.profit,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: rgb(0.05, 0.09, 0.17),
  });
  cursorY -= 28;

  const cardW = (width - marginX * 2 - 12) / 2;
  const cardH = 144;
  const cardY = cursorY - cardH;

  const drawCard = (x: number, title: string, lines: Array<[string, string, "pos" | "neg" | "normal"]>) => {
    page.drawRectangle({
      x,
      y: cardY,
      width: cardW,
      height: cardH,
      borderColor: rgb(0.88, 0.91, 0.94),
      borderWidth: 1,
    });
    page.drawText(title, {
      x: x + 10,
      y: cardY + cardH - 18,
      size: 10,
      font: fontBold,
      color: rgb(0.39, 0.45, 0.55),
    });
    let y = cardY + cardH - 36;
    for (const [label, value, tone] of lines) {
      page.drawText(label, { x: x + 10, y, size: 10, font, color: rgb(0.29, 0.35, 0.45) });
      const color =
        tone === "pos" ? rgb(0.05, 0.45, 0.34) : tone === "neg" ? rgb(0.74, 0.07, 0.23) : rgb(0.05, 0.09, 0.17);
      page.drawText(value, {
        x: x + cardW - 10 - font.widthOfTextAtSize(value, 10),
        y,
        size: 10,
        font: tone === "pos" ? fontBold : font,
        color,
      });
      y -= 16;
    }
  };

  drawCard(marginX, "Divided", [
    ["Gross profit", formatKes(metrics.grossProfit), "normal"],
    ["Less fixed deduction", formatKes(DIVIDED_FIXED_DEDUCTION), "normal"],
    ["Base profit", formatKes(metrics.baseProfit), "normal"],
    [`Divided (${DIVIDED_RATE_PCT}%)`, formatKes(metrics.divided), "pos"],
    ["Balance", formatKes(metrics.baseProfit - metrics.divided), "normal"],
  ]);

  drawCard(marginX + cardW + 12, "Hitech payout instruction", [
    ["Hitech payout", formatKes(metrics.hitechPayout), "normal"],
    ["Less divided", `- ${formatKes(metrics.divided)}`, "neg"],
    ["Send to Equity", formatKes(metrics.equity), "pos"],
  ]);

  return pdf.save();
}
