"use client";

import { useRouter } from "next/navigation";
import { CalendarCheck2 } from "lucide-react";
import { addShopInstallationBooking } from "@/app/shop/cartStore";

type BookInstallationButtonProps = {
  productId: string;
  productName: string;
  className?: string;
};

export default function BookInstallationButton({ productId, productName, className }: BookInstallationButtonProps) {
  const router = useRouter();
  return <button
    type="button"
    aria-label={`Book installation for ${productName}`}
    className={className}
    onClick={() => {
      addShopInstallationBooking(productId);
      router.push("/checkout");
    }}
  >
    <CalendarCheck2 className="h-4 w-4" />
    Book Installation
  </button>;
}
