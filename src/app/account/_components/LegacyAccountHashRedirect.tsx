"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const legacyRoutes: Record<string, string> = {
  "#address-details": "/account/address",
  "#lipa-pole-pole": "/account/lipa-pole-pole",
  "#quote-follow-up": "/account/quote-follow-up",
  "#site-visits": "/account/site-visits",
};

export default function LegacyAccountHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const route = legacyRoutes[window.location.hash];
    if (route) router.replace(route);
  }, [router]);

  return null;
}
