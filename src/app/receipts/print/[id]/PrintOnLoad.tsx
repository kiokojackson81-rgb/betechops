"use client";

import { useEffect } from "react";

export default function PrintOnLoad({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let closeTimer: number | null = null;

    const returnToCashier = () => {
      // Auto-print pages are opened by the receipt desk in a separate tab. Once
      // Chrome's print dialog is dismissed (whether the user prints or
      // cancels), return the operator to the still-active cashier workflow.
      if (!window.opener || window.opener.closed) return;
      closeTimer = window.setTimeout(() => {
        window.opener?.focus();
        window.close();
      }, 100);
    };

    window.addEventListener("afterprint", returnToCashier);
    const timer = window.setTimeout(() => {
      window.print();
    }, 150);
    return () => {
      window.clearTimeout(timer);
      if (closeTimer !== null) window.clearTimeout(closeTimer);
      window.removeEventListener("afterprint", returnToCashier);
    };
  }, [enabled]);

  return null;
}
