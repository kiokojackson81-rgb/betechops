"use client";

import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { addShopCartItem } from "@/app/shop/cartStore";
import { trackAddToCart } from "@/app/shop/shopAnalytics";
import { SHOP_CART_HREF } from "@/app/shop/storefrontPaths";

type AddToCartButtonProps = {
  productId: string;
  productName?: string;
  quantity?: number;
  className?: string;
};

export default function AddToCartButton({ productId, productName, quantity = 1, className }: AddToCartButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={productName ? `Add ${productName} to cart` : "Add product to cart"}
      onClick={() => {
        addShopCartItem(productId, quantity);
        trackAddToCart({ productId, productName, quantity });
        router.push(SHOP_CART_HREF);
      }}
      className={className}
    >
      <ShoppingCart className="h-4 w-4" />
      Add to Cart
    </button>
  );
}
