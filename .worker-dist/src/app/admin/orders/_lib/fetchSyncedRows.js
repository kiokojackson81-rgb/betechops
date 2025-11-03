"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSyncedRows = fetchSyncedRows;
const prisma_1 = require("@/lib/prisma");
const orderHelpers_1 = require("@/lib/jumia/orderHelpers");
function pickComparableDate(order) {
    var _a, _b, _c;
    return (_c = (_b = (_a = order.updatedAtJumia) !== null && _a !== void 0 ? _a : order.createdAtJumia) !== null && _b !== void 0 ? _b : order.updatedAt) !== null && _c !== void 0 ? _c : order.createdAt;
}
async function fetchSyncedRows(params) {
    var _a, _b;
    const where = {};
    if (params.status && params.status !== "ALL")
        where.status = params.status;
    if (params.shopId && params.shopId !== "ALL")
        where.shopId = params.shopId;
    if (params.country)
        where.countryCode = params.country.trim().toUpperCase();
    const from = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00Z`) : null;
    const to = params.dateTo ? new Date(`${params.dateTo}T23:59:59Z`) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
        const range = {};
        if (from && !Number.isNaN(from.getTime()))
            range.gte = from;
        if (to && !Number.isNaN(to.getTime()))
            range.lte = to;
        where.OR = [
            { updatedAtJumia: range },
            { AND: [{ updatedAtJumia: null }, { createdAtJumia: range }] },
            { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: range }] },
        ];
    }
    const normalizedStatus = ((_a = params.status) !== null && _a !== void 0 ? _a : "").toUpperCase();
    const defaultSize = normalizedStatus === "PENDING" ? 500 : 100;
    const parsedSize = Number.parseInt((_b = params.size) !== null && _b !== void 0 ? _b : "", 10);
    const take = Math.max(1, Math.min(Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : defaultSize, 1000));
    const orders = await prisma_1.prisma.jumiaOrder.findMany({
        where,
        include: {
            shop: {
                select: {
                    name: true,
                    account: { select: { label: true } },
                },
            },
        },
        orderBy: [
            { updatedAtJumia: "desc" },
            { createdAtJumia: "desc" },
            { updatedAt: "desc" },
        ],
        take,
    });
    const filtered = orders.filter((order) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const comparable = pickComparableDate(order);
        if (params.dateFrom) {
            const fromDate = new Date(`${params.dateFrom}T00:00:00Z`);
            if (!Number.isNaN(fromDate.getTime()) && comparable < fromDate)
                return false;
        }
        if (params.dateTo) {
            const toDate = new Date(`${params.dateTo}T23:59:59Z`);
            if (!Number.isNaN(toDate.getTime()) && comparable > toDate)
                return false;
        }
        if (params.q) {
            const term = params.q.trim().toLowerCase();
            if (term) {
                const maybeNumber = Number.parseInt(term, 10);
                const numberMatches = Number.isFinite(maybeNumber) && order.number !== null && order.number === maybeNumber;
                const textHaystack = [
                    order.id,
                    (_a = order.status) !== null && _a !== void 0 ? _a : "",
                    (_b = order.pendingSince) !== null && _b !== void 0 ? _b : "",
                    (_c = order.countryCode) !== null && _c !== void 0 ? _c : "",
                    (_e = (_d = order.shop) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : "",
                    (_h = (_g = (_f = order.shop) === null || _f === void 0 ? void 0 : _f.account) === null || _g === void 0 ? void 0 : _g.label) !== null && _h !== void 0 ? _h : "",
                ]
                    .concat(order.number !== null ? String(order.number) : [])
                    .map((value) => String(value).toLowerCase());
                const textMatches = textHaystack.some((value) => value.includes(term));
                if (!numberMatches && !textMatches)
                    return false;
            }
        }
        return true;
    });
    return filtered.map((order) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const created = (_b = (_a = order.createdAtJumia) !== null && _a !== void 0 ? _a : order.updatedAtJumia) !== null && _b !== void 0 ? _b : order.createdAt;
        const updated = (_c = order.updatedAtJumia) !== null && _c !== void 0 ? _c : order.updatedAt;
        // Show a single, clean shop name (avoid duplicating account label + shop name)
        const shopLabel = (_j = (0, orderHelpers_1.cleanShopName)((_e = (_d = order.shop) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : undefined, (_h = (_g = (_f = order.shop) === null || _f === void 0 ? void 0 : _f.account) === null || _g === void 0 ? void 0 : _g.label) !== null && _h !== void 0 ? _h : undefined)) !== null && _j !== void 0 ? _j : order.shopId;
        return {
            id: order.id,
            number: order.number !== null && order.number !== undefined ? String(order.number) : undefined,
            status: (_k = order.status) !== null && _k !== void 0 ? _k : undefined,
            pendingSince: (_l = order.pendingSince) !== null && _l !== void 0 ? _l : undefined,
            createdAt: (_o = (_m = created === null || created === void 0 ? void 0 : created.toISOString) === null || _m === void 0 ? void 0 : _m.call(created)) !== null && _o !== void 0 ? _o : new Date().toISOString(),
            updatedAt: (_p = updated === null || updated === void 0 ? void 0 : updated.toISOString) === null || _p === void 0 ? void 0 : _p.call(updated),
            totalItems: (_q = order.totalItems) !== null && _q !== void 0 ? _q : undefined,
            packedItems: (_r = order.packedItems) !== null && _r !== void 0 ? _r : undefined,
            shopName: shopLabel !== null && shopLabel !== void 0 ? shopLabel : undefined,
            shopId: (_s = order.shopId) !== null && _s !== void 0 ? _s : undefined,
            shopIds: order.shopId ? [order.shopId] : undefined,
            isPrepayment: (_t = order.isPrepayment) !== null && _t !== void 0 ? _t : undefined,
        };
    });
}
