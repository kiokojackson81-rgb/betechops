// src/app/admin/pending-pricing/page.tsx
import WeeklySummary from "./WeeklySummary";
import UnpricedOrdersClient from "./UnpricedOrdersClient";

export default async function PendingPricingPage() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <WeeklySummary />
      </div>
      <div className="mb-6">
        <UnpricedOrdersClient />
      </div>
    </div>
  );
}