"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersLiveData;
const react_1 = require("react");
const OrdersTable_1 = __importDefault(require("./OrdersTable"));
function OrdersLiveData({ initialRows, initialNextToken, initialIsLastPage, params, disableClientFetch = false, }) {
    const [rows, setRows] = (0, react_1.useState)(initialRows !== null && initialRows !== void 0 ? initialRows : []);
    const [nextToken, setNextToken] = (0, react_1.useState)(initialNextToken !== null && initialNextToken !== void 0 ? initialNextToken : null);
    const [isLastPage, setIsLastPage] = (0, react_1.useState)(initialIsLastPage !== null && initialIsLastPage !== void 0 ? initialIsLastPage : true);
    const [lastUpdatedAt, setLastUpdatedAt] = (0, react_1.useState)(Date.now());
    const busyRef = (0, react_1.useRef)(null);
    const lastFetchTsRef = (0, react_1.useRef)(0);
    const MIN_INTERVAL_MS = 2500;
    const query = (0, react_1.useMemo)(() => {
        const qs = new URLSearchParams();
        if (params.status && params.status !== "ALL")
            qs.set("status", params.status);
        if (params.country)
            qs.set("country", params.country);
        if (params.shopId)
            qs.set("shopId", params.shopId);
        if (params.dateFrom)
            qs.set("dateFrom", params.dateFrom);
        if (params.dateTo)
            qs.set("dateTo", params.dateTo);
        if (params.q)
            qs.set("q", params.q);
        if (params.size)
            qs.set("size", params.size);
        return qs.toString();
    }, [params.status, params.country, params.shopId, params.dateFrom, params.dateTo, params.q, params.size]);
    const storageKey = (0, react_1.useMemo)(() => {
        const base = disableClientFetch ? "orders:synced" : "orders:last";
        const path = typeof window !== "undefined" ? window.location.pathname : "";
        return `${base}:${path}?${query}`;
    }, [query, disableClientFetch]);
    const fetchLatest = (0, react_1.useCallback)(async () => {
        const now = Date.now();
        if (now - lastFetchTsRef.current < MIN_INTERVAL_MS) {
            return busyRef.current || Promise.resolve();
        }
        if (busyRef.current)
            return busyRef.current;
        const promise = (async () => {
            var _a, _b;
            try {
                lastFetchTsRef.current = Date.now();
                const endpoint = disableClientFetch ? "/api/orders/synced" : "/api/orders";
                const res = await fetch(`${endpoint}?${query}`, { cache: "no-store" });
                if (!res.ok)
                    return;
                const data = await res.json();
                const incoming = Array.isArray(data === null || data === void 0 ? void 0 : data.orders) ? data.orders : [];
                const shouldReplaceOnEmpty = disableClientFetch;
                if (incoming.length > 0 || shouldReplaceOnEmpty) {
                    setRows(incoming);
                    try {
                        if (typeof window !== "undefined") {
                            sessionStorage.setItem(storageKey, JSON.stringify({
                                rows: incoming,
                                ts: Date.now(),
                                nextToken: disableClientFetch ? null : (_a = data === null || data === void 0 ? void 0 : data.nextToken) !== null && _a !== void 0 ? _a : null,
                                isLastPage: disableClientFetch ? true : Boolean(data === null || data === void 0 ? void 0 : data.isLastPage),
                            }));
                        }
                    }
                    catch (_c) {
                        // ignore storage errors
                    }
                }
                if (disableClientFetch) {
                    setNextToken(null);
                    setIsLastPage(true);
                }
                else {
                    if (typeof (data === null || data === void 0 ? void 0 : data.nextToken) === "string" || (data === null || data === void 0 ? void 0 : data.nextToken) === null) {
                        setNextToken((_b = data.nextToken) !== null && _b !== void 0 ? _b : null);
                    }
                    if (typeof (data === null || data === void 0 ? void 0 : data.isLastPage) === "boolean") {
                        setIsLastPage(Boolean(data.isLastPage));
                    }
                }
                setLastUpdatedAt(Date.now());
            }
            catch (_d) {
                // keep prior snapshot on failure
            }
        })();
        busyRef.current = promise.finally(() => {
            busyRef.current = null;
        });
        return busyRef.current;
    }, [disableClientFetch, query, storageKey]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        const handler = () => {
            fetchLatest();
        };
        window.addEventListener("orders:refresh", handler);
        return () => {
            window.removeEventListener("orders:refresh", handler);
        };
    }, [fetchLatest]);
    (0, react_1.useEffect)(() => {
        var _a;
        if (typeof window !== "undefined") {
            try {
                const raw = sessionStorage.getItem(storageKey);
                if (rows.length === 0 && raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.rows)) {
                        setRows(parsed.rows);
                        if (typeof parsed.nextToken === "string" || parsed.nextToken === null) {
                            setNextToken((_a = parsed.nextToken) !== null && _a !== void 0 ? _a : null);
                        }
                        if (typeof parsed.isLastPage === "boolean") {
                            setIsLastPage(Boolean(parsed.isLastPage));
                        }
                        if (typeof parsed.ts === "number") {
                            setLastUpdatedAt(parsed.ts);
                        }
                    }
                }
            }
            catch (_b) {
                // ignore storage errors
            }
        }
        fetchLatest();
    }, [query, disableClientFetch, storageKey, fetchLatest]);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        if (rows.length === 0 && !disableClientFetch)
            return;
        try {
            sessionStorage.setItem(storageKey, JSON.stringify({ rows, ts: Date.now(), nextToken, isLastPage }));
        }
        catch (_a) {
            // ignore storage errors
        }
    }, [rows, nextToken, isLastPage, storageKey, disableClientFetch]);
    return (<div className="space-y-2">
      <div className="text-xs text-slate-500">Updated: {new Date(lastUpdatedAt).toLocaleTimeString()}</div>
      <OrdersTable_1.default rows={rows} nextToken={nextToken} isLastPage={isLastPage}/>
    </div>);
}
