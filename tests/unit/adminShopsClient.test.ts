import { addShopToList, assignUserToShop } from '@/app/admin/shops/_components/AdminShopsClient';

type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

describe('AdminShopsClient helpers', () => {
  const initial: ShopSummary[] = [
    { id: 'a', name: 'Shop A' },
    { id: 'b', name: 'Shop B', assignedUser: { id: 'u1', label: 'User One', roleAtShop: 'ATTENDANT' } },
  ];

  test('addShopToList prepends new shop', () => {
    const newShop: ShopSummary = { id: 'c', name: 'Shop C' };
    const out = addShopToList(initial, newShop);
    expect(out[0].id).toBe('c');
    expect(out.length).toBe(initial.length + 1);
  });

  test('assignUserToShop assigns user to matching shop', () => {
    const user = { id: 'u2', email: 'u2@example.com', name: 'User Two' };
    const out = assignUserToShop(initial, user, { shopId: 'a', roleAtShop: 'SUPERVISOR' });
  const assigned = out.find((s: ShopSummary) => s.id === 'a')!;
    expect(assigned.assignedUser).toBeDefined();
    expect(assigned.assignedUser?.id).toBe('u2');
    expect(assigned.assignedUser?.roleAtShop).toBe('SUPERVISOR');
  });

  test('assignUserToShop does nothing if no shopId provided', () => {
    const user = { id: 'u3', name: 'User Three' };
    const out = assignUserToShop(initial, user, undefined);
    expect(out).toEqual(initial);
  });
});
