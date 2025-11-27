"use client";

import React from "react";

export default function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: (e: any) => void;
  variant?: "primary" | "secondary" | "danger" | "muted";
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  const base = "rounded-xl px-4 py-2 font-semibold focus:outline-none";
  const variants: Record<string, string> = {
    primary: "text-white",
    secondary: "border border-white/10 text-slate-200 bg-transparent hover:bg-white/5",
    danger: "text-white",
    muted: "border border-white/5 text-slate-300 bg-transparent",
  };

  // For primary/danger we use CSS token colors via inline style so colors follow theme tokens.
  const style: React.CSSProperties | undefined =
    variant === "primary"
      ? { backgroundColor: "var(--primary)" }
      : variant === "danger"
      ? { backgroundColor: "var(--danger)" }
      : undefined;

  return (
    <button type={type} onClick={onClick} style={style} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
