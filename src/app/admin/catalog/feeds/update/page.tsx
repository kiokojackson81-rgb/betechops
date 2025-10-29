export const dynamic = "force-dynamic";

import EndpointConsole from "@/app/admin/_components/jumia/EndpointConsole";

const ENDPOINTS = [
  { label: "Update Products", path: "/feeds/products/update" },
  { label: "Create Products", path: "/feeds/products/create" },
  { label: "Update Price", path: "/feeds/products/price" },
  { label: "Update Stock", path: "/feeds/products/stock" },
  { label: "Update Status", path: "/feeds/products/status" },
];

export default function UpdateProductsFeedPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Update Products Feed</h1>
      <p className="text-sm text-slate-400">Post a Products Update feed to Jumia. Include <code>shopId</code> when needed and <code>products[]</code> with updatable fields.</p>
      <EndpointConsole endpoints={ENDPOINTS} />
    </div>
  );
}
