"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = FeedsConsolePage;
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const FeedLookup_1 = __importDefault(require("@/app/admin/_components/FeedLookup"));
const ENDPOINTS = [
    { label: "Create Products", path: "/feeds/products/create" },
    { label: "Update Products", path: "/feeds/products/update" },
    { label: "Update Price", path: "/feeds/products/price" },
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Status", path: "/feeds/products/status" },
    { label: "Get Feed by ID", path: "/feeds/{id}" },
];
function FeedsConsolePage() {
    return (<div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Products Feeds Console</h1>
      <FeedLookup_1.default />
      <p className="text-sm text-slate-400">
        Use this console to call Jumia Products feeds. Pick the shop, endpoint, and supply payload or query params.
        For GET /feeds/{'{'}id{'}'}, set the endpoint to /feeds/your-feed-id and use the Query box if needed.
      </p>
      <EndpointConsole_1.default endpoints={ENDPOINTS}/>
      <div className="text-xs text-slate-400">
        <p>Tips:</p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Start with up to 1000 items per feed as per vendor guidance.</li>
          <li>For create/update, include <code>shopId</code> and <code>products[]</code>. For price/stock/status, payload contains <code>products[]</code>.</li>
          <li>After posting a feed, use its returned <code>feedId</code> with GET /feeds/{'{'}id{'}'} to monitor progress.</li>
        </ul>
      </div>
    </div>);
}
