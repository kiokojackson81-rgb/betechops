process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || "tsconfig.node.json";
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { runAdminSummaryJob } = require("../src/lib/adminSummaryJob");

async function main() {
  const result = await runAdminSummaryJob();
  console.log(result.payload.summaryText);
}

main().catch((error) => {
  console.error("Failed to send admin summary", error);
  process.exit(1);
});
