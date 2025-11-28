"use client";

import React from "react";

export default function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  style,
}: {
  children: React.ReactNode;
  onClick?: (e: any) => void;
  variant?: "primary" | "secondary" | "danger" | "muted";
  className?: string;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
}) {
  const base = "rounded-xl px-4 py-2 focus:outline-none inline-flex items-center justify-center gap-2";
  const variants: Record<string, string> = {
    primary: "btn-primary",
    secondary: "border border-white/10 text-slate-200 bg-transparent hover:bg-white/5",
    danger: "btn-danger",
    muted: "border border-white/5 text-slate-300 bg-transparent",
  };

  return (
    <button type={type} onClick={onClick} style={style} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
