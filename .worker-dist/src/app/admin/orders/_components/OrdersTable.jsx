"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersTable;
const navigation_1 = require("next/navigation");
const react_1 = require("react");
function OrdersTable({ rows, nextToken, isLastPage }) {
    const [busy, setBusy] = (0, react_1.useState)(null);
    const [details, setDetails] = (0, react_1.useState)({});
    const pathname = (0, navigation_1.usePathname)();
    const router = (0, navigation_1.useRouter)();
    const sp = (0, navigation_1.useSearchParams)();
    const dispatchRefresh = () => {
        try {
            window.dispatchEvent(new CustomEvent("orders:refresh", { detail: { source: "action", ts: Date.now() } }));
        }
        catch (_a) {
            // ignored
        }
    };
    async function callAction(row, action) {
        var _a, _b;
        const id = row.id;
        const key = `${id}:${action}`;
        setBusy(key);
        try {
            if (action === "print") {
                const url = `/api/jumia/orders/${id}/print-labels`;
                window.open(url, "_blank");
                return;
            }
            const endpoint = action === "pack"
                ? `/api/jumia/orders/${id}/pack`
                : `/api/jumia/orders/${id}/ready-to-ship`;
            const res = await fetch(endpoint, { method: "POST" });
            if (!res.ok) {
                throw new Error(`Action ${action} failed with status ${res.status}`);
            }
            const shopId = (_b = (_a = row.shopId) !== null && _a !== void 0 ? _a : (Array.isArray(row.shopIds) ? row.shopIds.find((s) => typeof s === "string") : undefined)) !== null && _b !== void 0 ? _b : undefined;
            try {
                const params = new URLSearchParams();
                if (shopId)
                    params.set("shopId", shopId);
                const query = params.toString();
                await fetch(`/api/jumia/jobs/sync-incremental${query ? `?${query}` : ""}`, { method: "POST" });
            }
            catch (err) {
                console.warn("[orders.table] incremental sync failed", err);
            }
            dispatchRefresh();
            router.refresh();
        }
        catch (error) {
            console.warn("[orders.table] action failed", error);
        }
        finally {
            setBusy(null);
        }
    }
    function pageNext() {
        if (!nextToken)
            return;
        const q = new URLSearchParams(sp.toString());
        q.set("nextToken", nextToken);
        router.push(`${pathname}?${q.toString()}`);
    }
    function pagePrev() {
        const q = new URLSearchParams(sp.toString());
        q.delete("nextToken");
        router.push(`${pathname}?${q.toString()}`);
    }
    // Lazy-load per-order item details (product URL and computed amount) for rows missing them.
    const idsNeedingDetails = (0, react_1.useMemo)(() => {
        return rows
            .filter((r) => !details[r.id])
            .map((r) => ({ id: r.id, shopId: r.shopId || (Array.isArray(r.shopIds) ? r.shopIds[0] : undefined) }));
    }, [rows, details]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        async function load() {
            for (const { id, shopId } of idsNeedingDetails) {
                try {
                    const url = shopId ? `/api/jumia/orders/${encodeURIComponent(id)}/items?shopId=${encodeURIComponent(shopId)}` : `/api/jumia/orders/${encodeURIComponent(id)}/items`;
                    const res = await fetch(url, { cache: "no-store" });
                    if (!res.ok)
                        continue;
                    const j = await res.json();
                    if (cancelled)
                        return;
                    setDetails((prev) => (Object.assign(Object.assign({}, prev), { [id]: {
                            url: (j === null || j === void 0 ? void 0 : j.primaryProductUrl) || undefined,
                            name: (j === null || j === void 0 ? void 0 : j.primaryProductName) || undefined,
                            total: (j === null || j === void 0 ? void 0 : j.totalAmountLocal) || undefined,
                            count: typeof (j === null || j === void 0 ? void 0 : j.itemsCount) === "number" ? j.itemsCount : Array.isArray(j === null || j === void 0 ? void 0 : j.items) ? j.items.length : undefined,
                        } })));
                }
                catch (_a) {
                    // ignore
                }
            }
        }
        if (idsNeedingDetails.length)
            void load();
        return () => {
            cancelled = true;
        };
    }, [idsNeedingDetails]);
    return (<div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left bg-black/10">
          <tr>
            <th className="px-3 py-2">Order #</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Items</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Shop</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (<tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                No orders found.
              </td>
            </tr>)}
          {rows.map((row) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
            const actionBusy = busy === `${row.id}:pack` || busy === `${row.id}:rts`;
            const printBusy = busy === `${row.id}:print`;
            return (<tr key={row.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium">{(_a = row.number) !== null && _a !== void 0 ? _a : row.id}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5">{row.status}</span>
                  {row.pendingSince && <span className="ml-2 text-xs opacity-70">- {row.pendingSince}</span>}
                </td>
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {typeof row.packedItems === "number" && typeof row.totalItems === "number"
                    ? `${row.packedItems}/${row.totalItems}`
                    : (_b = row.totalItems) !== null && _b !== void 0 ? _b : "-"}
                </td>
                <td className="px-3 py-2">
                  {row.totalAmountLocal
                    ? `${(_c = row.totalAmountLocal.currency) !== null && _c !== void 0 ? _c : ""} ${row.totalAmountLocal.value.toLocaleString()}`.trim()
                    : ((_d = details[row.id]) === null || _d === void 0 ? void 0 : _d.total)
                        ? `${(_g = (_f = (_e = details[row.id]) === null || _e === void 0 ? void 0 : _e.total) === null || _f === void 0 ? void 0 : _f.currency) !== null && _g !== void 0 ? _g : ""} ${(_j = (_h = details[row.id]) === null || _h === void 0 ? void 0 : _h.total) === null || _j === void 0 ? void 0 : _j.value.toLocaleString()}`.trim()
                        : "-"}
                </td>
                <td className="px-3 py-2">
                  {((_k = details[row.id]) === null || _k === void 0 ? void 0 : _k.url) ? (<a href={(_m = (_l = details[row.id]) === null || _l === void 0 ? void 0 : _l.url) !== null && _m !== void 0 ? _m : "#"} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline" title={((_o = details[row.id]) === null || _o === void 0 ? void 0 : _o.name) || "Open product on Jumia"}>
                      {((_s = (_q = (_p = row.shopName) !== null && _p !== void 0 ? _p : row.shopId) !== null && _q !== void 0 ? _q : (_r = row.shopIds) === null || _r === void 0 ? void 0 : _r[0]) !== null && _s !== void 0 ? _s : "-")}
                      {((_u = (_t = details[row.id]) === null || _t === void 0 ? void 0 : _t.count) !== null && _u !== void 0 ? _u : 0) > 1 && (<span className="ml-1 text-xs opacity-70">(x{(_v = details[row.id]) === null || _v === void 0 ? void 0 : _v.count})</span>)}
                    </a>) : (<>
                      {(_z = (_x = (_w = row.shopName) !== null && _w !== void 0 ? _w : row.shopId) !== null && _x !== void 0 ? _x : (_y = row.shopIds) === null || _y === void 0 ? void 0 : _y[0]) !== null && _z !== void 0 ? _z : "-"}
                      {((_1 = (_0 = details[row.id]) === null || _0 === void 0 ? void 0 : _0.count) !== null && _1 !== void 0 ? _1 : 0) > 1 && (<span className="ml-1 text-xs opacity-70">(x{(_2 = details[row.id]) === null || _2 === void 0 ? void 0 : _2.count})</span>)}
                    </>)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-60" onClick={() => callAction(row, "pack")} disabled={busy !== null}>
                      {actionBusy && (busy === null || busy === void 0 ? void 0 : busy.endsWith(":pack")) ? "…" : "Pack"}
                    </button>
                    <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-60" onClick={() => callAction(row, "rts")} disabled={busy !== null}>
                      {actionBusy && (busy === null || busy === void 0 ? void 0 : busy.endsWith(":rts")) ? "…" : "RTS"}
                    </button>
                    <button className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-60" onClick={() => callAction(row, "print")} disabled={printBusy}>
                      {printBusy ? "…" : "Print"}
                    </button>
                  </div>
                </td>
              </tr>);
        })}
        </tbody>
      </table>

      <div className="flex items-center justify-between px-3 py-3 border-t border-white/10">
        <button onClick={pagePrev} className="px-3 py-1 rounded border border-white/10 hover:bg-white/10">
          First page
        </button>
        <div className="text-xs opacity-70">
          {isLastPage ? "Last page" : nextToken ? "More results available" : ""}
        </div>
        <button onClick={pageNext} disabled={!nextToken} className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-40">
          Next
        </button>
      </div>
    </div>);
}
