"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { trackWhatsAppClick } from "@/app/shop/shopAnalytics";

type TrackedWhatsAppLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
  label: string;
  context: string;
  ariaLabel?: string;
};

export default function TrackedWhatsAppLink({
  href,
  className,
  children,
  label,
  context,
  ariaLabel,
}: TrackedWhatsAppLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      onClick={() => {
        trackWhatsAppClick({ label, context, href });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
