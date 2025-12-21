type Props = {
  title?: string;
  className?: string;
  reason?: string;
};

const missingTables = [
  "MarketplaceAccount",
  "MarketplaceAccountAssignment",
  "MarketplacePayoutWeek",
  "MarketplaceOrder",
  "MarketplaceReturn",
];

export default function MarketplaceDataFallback({
  title = "Marketplace data not initialized",
  className = "",
  reason = "The marketplace tables introduced in the online ops release are missing in this environment, so Prisma can't return any metrics.",
}: Props) {
  return (
    <div className={`rounded-3xl border border-rose-500/30 bg-rose-500/5 px-6 py-6 text-rose-100 shadow-lg shadow-black/30 ${className}`}>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-rose-300">Online ops</p>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-rose-100/90">{reason}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-rose-500/40 bg-black/40 p-4 text-sm text-rose-100/90">
        <p className="font-semibold text-rose-100">How to unblock</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Deploy the pending Prisma migrations to your production database:
            <code className="ml-2 rounded bg-black/40 px-2 py-0.5 text-xs text-rose-200">pnpm prisma migrate deploy</code>
          </li>
          <li>
            Confirm the marketplace tables exist ({missingTables.join(", ")}) via your SQL client or{" "}
            <code className="text-rose-200">SELECT</code> statements.
          </li>
          <li>
            Rerun the online sync job (or wait for the nightly run) so the new tables are populated, then refresh this page.
          </li>
        </ol>
        <p className="mt-3 text-xs text-rose-200/80">
          These steps ensure Prisma can query the online ops data without failing migrations like{" "}
          <code className="text-rose-100">20251205_guard_weekly_attendant_fix</code>.
        </p>
      </div>
    </div>
  );
}
