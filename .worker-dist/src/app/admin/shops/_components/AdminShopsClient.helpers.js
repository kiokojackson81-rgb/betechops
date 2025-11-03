"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addShopToList = addShopToList;
exports.assignUserToShop = assignUserToShop;
function addShopToList(prev, s) {
    return [s, ...prev];
}
function assignUserToShop(prev, user, assigned) {
    if (!(assigned === null || assigned === void 0 ? void 0 : assigned.shopId))
        return prev;
    return prev.map(p => { var _a, _b; return p.id === assigned.shopId ? Object.assign(Object.assign({}, p), { assignedUser: { id: user.id, label: (_b = (_a = user.name) !== null && _a !== void 0 ? _a : user.email) !== null && _b !== void 0 ? _b : '', roleAtShop: assigned.roleAtShop } }) : p; });
}
