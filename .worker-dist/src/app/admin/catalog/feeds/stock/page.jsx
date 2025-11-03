"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = StockFeedPage;
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const ENDPOINTS = [
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Price", path: "/feeds/products/price" },
    { label: "Update Status", path: "/feeds/products/status" },
];
function StockFeedPage() {
    return (<div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Stock Update Feed</h1>
      <p className="text-sm text-slate-400">Post a Stock Update feed to Jumia. Payload: <code>{'{'} products: [...] {'}'} </code></p>
      <EndpointConsole_1.default endpoints={ENDPOINTS}/>
    </div>);
}
