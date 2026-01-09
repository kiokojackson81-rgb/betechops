"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addShopToList = addShopToList;
exports.assignUserToShop = assignUserToShop;
function addShopToList(prev, s) {
    return [s, ...prev];
}
function assignUserToShop(prev, user, assigned) {
    if (!assigned?.shopId)
        return prev;
    return prev.map(p => p.id === assigned.shopId ? { ...p, assignedUser: { id: user.id, label: user.name ?? user.email ?? '', roleAtShop: assigned.roleAtShop } } : p);
}
