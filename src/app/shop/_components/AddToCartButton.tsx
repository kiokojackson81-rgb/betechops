"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { addShopCartItem } from "@/app/shop/cartStore";
import { trackAddToCart } from "@/app/shop/shopAnalytics";

type AddToCartButtonProps = {
  productId: string;
  productName?: string;
  quantity?: number;
  className?: string;
};

export default function AddToCartButton({ productId, productName, quantity = 1, className }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      aria-label={productName ? `Add ${productName} to cart` : "Add product to cart"}
      onClick={() => {
        addShopCartItem(productId, quantity);
        trackAddToCart({ productId, productName, quantity });
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1600);
      }}
      className={className}
    >
      <ShoppingCart className="h-4 w-4" />
      {added ? "Added to Cart" : "Add to Cart"}
    </button>
  );
}
