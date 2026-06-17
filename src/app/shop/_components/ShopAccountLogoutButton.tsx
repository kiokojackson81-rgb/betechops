"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function ShopAccountLogoutButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
        onClick={async () => {
          try {
            setBusy(true);
            await signOut({ callbackUrl: "/" });
          } finally {
            setBusy(false);
          }
        }}
      className="inline-flex items-center justify-center rounded-2xl border border-[#7a0000]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#7a0000] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Signing out..." : "Log out"}
    </button>
  );
}
