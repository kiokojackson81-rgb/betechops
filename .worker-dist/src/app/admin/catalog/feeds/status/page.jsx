"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = StatusFeedPage;
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const ENDPOINTS = [
    { label: "Update Status", path: "/feeds/products/status" },
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Price", path: "/feeds/products/price" },
];
function StatusFeedPage() {
    return (<div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Status Update Feed</h1>
      <p className="text-sm text-slate-400">Post a Status Update feed to Jumia. Payload: <code>{'{'} products: [...] {'}'} </code></p>
      <EndpointConsole_1.default endpoints={ENDPOINTS}/>
    </div>);
}
