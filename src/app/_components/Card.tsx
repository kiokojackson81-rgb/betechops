"use client";

import React from "react";

export default function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "kpi" | "muted";
}) {
  const base = "rounded-2xl p-4";
  const variantClass =
    variant === "kpi"
      ? "border border-[var(--border)] bg-[var(--card-bg)]"
      : variant === "muted"
      ? "border border-white/5 bg-transparent"
      : "border border-white/10 bg-[var(--card,#171b23)] card-top-accent";

  return (
    <div className={`${base} ${variantClass} ${className}`}>
      {children}
    </div>
  );
}
