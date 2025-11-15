"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SyncedShopsList;
const react_1 = __importDefault(require("react"));
function formatTs(value) {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    try {
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Africa/Nairobi",
        }).format(date);
    }
    catch {
        return date.toISOString();
    }
}
function SyncedShopsList({ shops }) {
    if (!Array.isArray(shops) || shops.length === 0) {
        return (<p className="text-sm text-slate-400">
        No synced Jumia shops detected yet.
      </p>);
    }
    return (<div className="space-y-3">
      {shops.map((shop) => {
            const lastSync = formatTs(shop.lastOrdersUpdatedBefore);
            const updated = formatTs(shop.updatedAt);
            return (<div key={shop.id} className="rounded border border-white/10 bg-white/5 p-3">
            <div className="font-medium">{shop.name}</div>
            <div className="text-xs text-slate-400">
              Account: {shop.accountLabel ?? "Jumia"} · ID: {shop.id}
            </div>
            {lastSync && (<div className="text-xs text-slate-400">
                Last orders sync: {lastSync}
              </div>)}
            {!lastSync && updated && (<div className="text-xs text-slate-500">
                Updated: {updated}
              </div>)}
          </div>);
        })}
    </div>);
}
