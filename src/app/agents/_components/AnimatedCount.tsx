"use client";

import { useEffect, useMemo, useState } from "react";

type AnimatedCountProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
};

export default function AnimatedCount({
  value,
  prefix = "",
  suffix = "",
  durationMs = 1400,
}: AnimatedCountProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const target = useMemo(() => Math.max(0, Math.trunc(value)), [value]);

  useEffect(() => {
    let frame = 0;
    let start = 0;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, target]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}
