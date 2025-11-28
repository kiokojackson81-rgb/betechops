"use client";

import React from "react";

export default function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: (e: any) => void;
  variant?: "primary" | "secondary" | "danger" | "muted";
  className?: string;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const base = "rounded-xl px-4 py-2 focus:outline-none inline-flex items-center justify-center gap-2 text-sm";
  const variants: Record<string, string> = {
    primary: "bg-betech-orange text-black font-semibold hover:brightness-95",
    secondary: "border border-white/10 text-slate-200 bg-transparent hover:bg-white/5",
    danger: "bg-betech-maroon text-white font-semibold hover:opacity-95",
    muted: "border border-white/5 text-slate-300 bg-transparent",
  };

  return (
    <button type={type} onClick={onClick} style={style} disabled={disabled} className={`${base} ${variants[variant]} ${className} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}
