export type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

export function addShopToList(prev: ShopSummary[], s: ShopSummary): ShopSummary[] {
  return [s, ...prev];
}

export function assignUserToShop(prev: ShopSummary[], user: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }): ShopSummary[] {
  if (!assigned?.shopId) return prev;
  return prev.map(p => p.id === assigned.shopId ? { ...p, assignedUser: { id: user.id, label: user.name ?? user.email ?? '', roleAtShop: assigned.roleAtShop } } : p);
}
