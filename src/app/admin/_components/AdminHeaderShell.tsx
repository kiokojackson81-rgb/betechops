"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function AdminHeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide the admin header for the public admin login page
  if (pathname?.startsWith("/admin/login")) {
    return null;
  }

  return <div className="sticky top-0 z-50 shadow-lg shadow-black/30">{children}</div>;
}
