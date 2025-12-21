import React from "react";

interface ProgressBarProps {
  value: number; // current
  max: number; // target
  label?: string;
}

export default function ProgressBar({ value, max, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const ariaValueNow = Math.max(0, Math.min(value, max));
  return (
    <div className="progressbar-root" aria-hidden={false}>
      <label className="text-[11px] opacity-70 mb-1 block">{label ?? "Progress"} — <span className="font-medium">{value}/{max}</span></label>
      <progress className="w-full h-2 rounded-full" value={ariaValueNow} max={max} aria-valuemin={0} aria-valuemax={max} aria-valuenow={ariaValueNow} />
      <div className="text-xs mt-1 opacity-70">{pct}%</div>
    </div>
  );
}
