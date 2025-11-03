"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = CreateProductsFeedPage;
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const ENDPOINTS = [
    { label: "Create Products", path: "/feeds/products/create" },
    { label: "Update Products", path: "/feeds/products/update" },
    { label: "Update Price", path: "/feeds/products/price" },
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Status", path: "/feeds/products/status" },
];
function CreateProductsFeedPage() {
    return (<div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create Products Feed</h1>
      <p className="text-sm text-slate-400">Post a Products Creation feed to Jumia. Include <code>shopId</code> and <code>products[]</code> in the payload.</p>
      <EndpointConsole_1.default endpoints={ENDPOINTS}/>
    </div>);
}
