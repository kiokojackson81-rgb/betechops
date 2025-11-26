"use client";

import React from "react";

export default function Button({ children, onClick, variant = "primary", className = "", type = "button" }: { children: React.ReactNode; onClick?: (e: any) => void; variant?: "primary" | "secondary" | "danger"; className?: string; type?: "button" | "submit" | "reset" }) {
  const base = "rounded-xl px-4 py-2 font-semibold focus:outline-none";
  const variants: Record<string, string> = {
    primary: "bg-sky-600 hover:bg-sky-700 text-white",
    secondary: "border border-white/10 text-slate-200 bg-transparent hover:bg-white/5",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };
  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
