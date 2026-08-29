"use client";

import { useEffect, useState } from "react";
import type { ShopProduct } from "@/app/shop/shopData";

export type ShopCartItem = {
  productId: string;
  quantity: number;
  bookingType?: "INSTALLATION";
};

const SHOP_CART_KEY = "betech-shop-cart";
const SHOP_CART_EVENT = "betech-shop-cart-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeCart(items: ShopCartItem[]) {
  return items
    .filter((item) => item.productId && item.quantity > 0)
    .map((item) => ({
      productId: item.productId,
      quantity: Math.max(1, Math.floor(item.quantity)),
      ...(item.bookingType === "INSTALLATION" ? { bookingType: item.bookingType } : {}),
    }));
}

export function readShopCart(): ShopCartItem[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(SHOP_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShopCartItem[];
    return normalizeCart(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function writeShopCart(items: ShopCartItem[]) {
  if (!isBrowser()) return;
  const normalized = normalizeCart(items);
  window.localStorage.setItem(SHOP_CART_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(SHOP_CART_EVENT, { detail: normalized }));
}

export function addShopCartItem(productId: string, quantity = 1) {
  const current = readShopCart();
  const existing = current.find((item) => item.productId === productId);

  if (existing) {
    writeShopCart(
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + Math.max(1, quantity) } : item,
      ),
    );
    return;
  }

  writeShopCart([...current, { productId, quantity: Math.max(1, quantity) }]);
}

export function addShopInstallationBooking(productId: string, quantity = 1) {
  const current = readShopCart();
  const existing = current.find((item) => item.productId === productId);
  if (existing) {
    writeShopCart(current.map((item) => item.productId === productId
      ? { ...item, quantity: Math.max(1, quantity), bookingType: "INSTALLATION" as const }
      : item));
    return;
  }
  writeShopCart([...current, { productId, quantity: Math.max(1, quantity), bookingType: "INSTALLATION" }]);
}

export function updateShopCartQuantity(productId: string, quantity: number) {
  const current = readShopCart();
  if (quantity <= 0) {
    writeShopCart(current.filter((item) => item.productId !== productId));
    return;
  }

  writeShopCart(
    current.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, Math.floor(quantity)) } : item,
    ),
  );
}

export function removeShopCartItem(productId: string) {
  writeShopCart(readShopCart().filter((item) => item.productId !== productId));
}

export function clearShopCart() {
  writeShopCart([]);
}

export function getShopCartCount() {
  return readShopCart().reduce((sum, item) => sum + item.quantity, 0);
}

export function buildDetailedCart(items: ShopCartItem[], products: ShopProduct[]) {
  return items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) return null;
      return {
        product,
        quantity: item.quantity,
        lineTotal: product.price * item.quantity,
        bookingType: item.bookingType,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
}

export function useShopCartItems() {
  const [items, setItems] = useState<ShopCartItem[]>([]);

  useEffect(() => {
    setItems(readShopCart());

    const sync = () => setItems(readShopCart());
    window.addEventListener("storage", sync);
    window.addEventListener(SHOP_CART_EVENT, sync as EventListener);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SHOP_CART_EVENT, sync as EventListener);
    };
  }, []);

  return items;
}
