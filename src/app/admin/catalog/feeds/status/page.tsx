export const dynamic = "force-dynamic";

import EndpointConsole from "@/app/admin/_components/jumia/EndpointConsole";

const ENDPOINTS = [
  { label: "Update Status", path: "/feeds/products/status" },
  { label: "Update Stock", path: "/feeds/products/stock" },
  { label: "Update Price", path: "/feeds/products/price" },
];

export default function StatusFeedPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Status Update Feed</h1>
      <p className="text-sm text-slate-400">Post a Status Update feed to Jumia. Payload: <code>{'{'} products: [...] {'}'} </code></p>
      <EndpointConsole endpoints={ENDPOINTS} />
    </div>
  );
}
