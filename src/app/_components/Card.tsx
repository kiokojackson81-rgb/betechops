"use client";

import React from "react";

export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 p-4 bg-[var(--card,#171b23)] ${className}`}>
      {children}
    </div>
  );
}
