"use client";

import { useEffect } from "react";

export default function BookingReceiptAutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  return null;
}
