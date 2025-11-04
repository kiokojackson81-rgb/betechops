"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminShopsClient;
const react_1 = __importStar(require("react"));
const ShopForm_1 = __importDefault(require("./ShopForm"));
const AttendantForm_1 = __importDefault(require("./AttendantForm"));
const ShopsList_1 = __importDefault(require("./ShopsList"));
const toast_1 = require("@/lib/ui/toast");
const ShopsActionsContext_1 = require("./ShopsActionsContext");
const AdminShopsClient_helpers_1 = require("./AdminShopsClient.helpers");
function AdminShopsClient({ initial }) {
    const [shops, setShops] = (0, react_1.useState)(initial || []);
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
    return (<ShopsActionsContext_1.ShopsActionsProvider value={actions}>
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Create Shop</h2>
          <ShopForm_1.default />
          <div className="mt-4">
            <h3 className="font-semibold">Create Attendant</h3>
            <AttendantForm_1.default shops={shops.map(s => ({ id: s.id, name: s.name }))}/>
          </div>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-semibold">Existing Shops</h2>
          <ShopsList_1.default initial={shops}/>
        </div>
      </div>
    </ShopsActionsContext_1.ShopsActionsProvider>);
}
