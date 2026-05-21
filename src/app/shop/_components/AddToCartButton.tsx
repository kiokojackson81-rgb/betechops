"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { addShopCartItem } from "@/app/shop/cartStore";

type AddToCartButtonProps = {
  productId: string;
  quantity?: number;
  className?: string;
};

export default function AddToCartButton({ productId, quantity = 1, className }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        addShopCartItem(productId, quantity);
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
