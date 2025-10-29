export const dynamic = "force-dynamic";

import EndpointConsole from "@/app/admin/_components/jumia/EndpointConsole";

const ENDPOINTS = [
  { label: "Create Products", path: "/feeds/products/create" },
  { label: "Update Products", path: "/feeds/products/update" },
  { label: "Update Price", path: "/feeds/products/price" },
  { label: "Update Stock", path: "/feeds/products/stock" },
  { label: "Update Status", path: "/feeds/products/status" },
];

export default function CreateProductsFeedPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create Products Feed</h1>
      <p className="text-sm text-slate-400">Post a Products Creation feed to Jumia. Include <code>shopId</code> and <code>products[]</code> in the payload.</p>
      <EndpointConsole endpoints={ENDPOINTS} />
    </div>
  );
}
