"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminShopsClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ShopForm_1 = __importDefault(require("./ShopForm"));
const AttendantForm_1 = __importDefault(require("./AttendantForm"));
const ShopsList_1 = __importDefault(require("./ShopsList"));
const toast_1 = require("@/lib/ui/toast");
const ShopsActionsContext_1 = require("./ShopsActionsContext");
const AdminShopsClient_helpers_1 = require("./AdminShopsClient.helpers");
function AdminShopsClient({ initial }) {
    const [shops, setShops] = (0, react_1.useState)(initial || []);
    const [hydrated, setHydrated] = (0, react_1.useState)(false);
    // Client-side hydration fallback: if server didn't provide any shops,
    // fetch from the public API to avoid an empty panel in prod after cold deploys.
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        (async () => {
            if ((initial?.length ?? 0) > 0 || hydrated)
                return;
            try {
                const res = await fetch('/api/shops', { cache: 'no-store' });
                if (!res.ok)
                    return;
                const list = (await res.json());
                if (!cancelled && Array.isArray(list) && list.length) {
                    const mapped = list.map((s) => ({ id: s.id, name: s.name, platform: s.platform ?? undefined }));
                    setShops(mapped);
                    setHydrated(true);
                }
            }
            catch {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [initial, hydrated]);
    function onShopCreated(s) {
        setShops(prev => (0, AdminShopsClient_helpers_1.addShopToList)(prev, s));
        (0, toast_1.showToast)('Shop created', 'success');
    }
    function onAttendantCreated(user, assigned) {
        setShops(prev => (0, AdminShopsClient_helpers_1.assignUserToShop)(prev, user, assigned));
        if (assigned?.shopId)
            (0, toast_1.showToast)('Attendant assigned', 'success');
    }
    const actions = {
        onShopCreated: (s) => onShopCreated(s),
        onAttendantCreated: (u, assigned) => onAttendantCreated(u, assigned),
    };
    return ((0, jsx_runtime_1.jsx)(ShopsActionsContext_1.ShopsActionsProvider, { value: actions, children: (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "p-4 border rounded", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-semibold", children: "Create Shop" }), (0, jsx_runtime_1.jsx)(ShopForm_1.default, {}), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold", children: "Create Attendant" }), (0, jsx_runtime_1.jsx)(AttendantForm_1.default, { shops: shops.map(s => ({ id: s.id, name: s.name })) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 border rounded", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-semibold", children: "Existing Shops" }), (0, jsx_runtime_1.jsx)(ShopsList_1.default, { initial: shops })] })] }) }));
}
