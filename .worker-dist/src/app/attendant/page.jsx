"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantDashboard;
const react_1 = require("react");
const QueueList_1 = __importDefault(require("./_components/QueueList"));
const QuickPriceCard_1 = __importDefault(require("./_components/QuickPriceCard"));
const ReturnsCard_1 = __importDefault(require("./_components/ReturnsCard"));
const ShopSnapshot_1 = __importDefault(require("./_components/ShopSnapshot"));
const Shortcuts_1 = __importDefault(require("./_components/Shortcuts"));
const Announcement_1 = __importDefault(require("./_components/Announcement"));
function AttendantDashboard() {
    const [shopId, setShopId] = (0, react_1.useState)(undefined);
    (0, react_1.useEffect)(() => {
        const saved = localStorage.getItem("shopId") || undefined;
        setShopId(saved || undefined);
    }, []);
    return (<div className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Attendant Dashboard</h1>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Shop:</span>
          <select className="rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" value={shopId || ""} onChange={(e) => { const val = e.target.value || undefined; setShopId(val); if (val)
        localStorage.setItem("shopId", val); }}>
            <option value="">All</option>
            <option value="1">Shop 1</option>
            <option value="2">Shop 2</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-6">
          <QueueList_1.default shopId={shopId}/>
          <QuickPriceCard_1.default />
          <ReturnsCard_1.default />
        </div>

        <div className="space-y-6">
          <ShopSnapshot_1.default shopId={shopId}/>
          <Shortcuts_1.default />
          <Announcement_1.default />
        </div>
      </div>
    </div>);
}
