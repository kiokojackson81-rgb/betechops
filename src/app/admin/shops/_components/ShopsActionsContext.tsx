"use client";
import React, { createContext, useContext } from 'react';

export type ShopSummary = { id: string; name: string; platform?: string; assignedUser?: { id: string; label: string; roleAtShop?: string } };

export type ShopsActions = {
  onShopCreated: (s: ShopSummary) => void;
  onAttendantCreated: (u: { id: string; email?: string; name?: string }, assigned?: { shopId?: string; roleAtShop?: string }) => void;
};

const ctx = createContext<ShopsActions | null>(null);

export function ShopsActionsProvider({ children, value }: { children: React.ReactNode; value: ShopsActions }) {
  return <ctx.Provider value={value}>{children}</ctx.Provider>;
}

export function useShopsActions() {
  const v = useContext(ctx);
  if (!v) throw new Error('useShopsActions must be used within ShopsActionsProvider');
  return v;
}
