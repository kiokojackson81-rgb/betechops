const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { computeAdminReceiptSummary } = require("../src/lib/adminReceiptsSummary");
  const { getTradingPeriodFor } = require("../src/lib/tradingPeriod");
  const { buildAdminSummaryMessage } = require("../src/lib/adminSummaryMessage");

  const cutoffsDir = path.resolve(__dirname, ".cache");
  if (!fs.existsSync(cutoffsDir)) {
    fs.mkdirSync(cutoffsDir, { recursive: true });
  }
  const cutoffFile = path.join(cutoffsDir, "last-admin-summary.json");

  let lastEnd = null;
  if (fs.existsSync(cutoffFile)) {
    try {
      const payload = JSON.parse(fs.readFileSync(cutoffFile, "utf-8"));
      lastEnd = payload?.lastEnd ? new Date(payload.lastEnd) : null;
    } catch (error) {
      console.warn("Unable to parse previous cutoff file; starting from trading period start", error.message);
    }
  }

  const now = new Date();
  const tradingPeriod = getTradingPeriodFor(now);
  const start = lastEnd && lastEnd < now ? lastEnd : tradingPeriod.start;
  const end = now;

  const summary = await computeAdminReceiptSummary({ start, end, scope: "global" });
  const payload = buildAdminSummaryMessage({ summary, start, end });
  console.log(payload.summaryText);

  fs.writeFileSync(
    cutoffFile,
    JSON.stringify({ lastEnd: end.toISOString() }, null, 2),
    "utf-8",
  );
}

main().catch((error) => {
  console.error("Failed to send admin summary", error);
  process.exit(1);
});
