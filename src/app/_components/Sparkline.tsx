"use client";

import React from "react";

export default function Sparkline({
  values = [],
  color = "var(--primary)",
  width = 120,
  height = 28,
}: {
  values?: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const w = width;
  const h = height;
  if (!values || values.length === 0) return <svg width={w} height={h} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = Math.round(i * step);
    const y = Math.round(h - ((v - min) / range) * h);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        points={points.join(" ")}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
