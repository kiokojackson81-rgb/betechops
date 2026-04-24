"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getTradingPeriodFor,
  parseTradingPeriodKey,
  type TradingPeriod,
} from "@/lib/tradingPeriod";

export default function useTradingPeriodQueryState(paramName = "period") {
  const currentPeriod = useMemo(() => getTradingPeriodFor(new Date()), []);
  const [selectedPeriod, setSelectedPeriodState] = useState<TradingPeriod>(currentPeriod);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedPeriod = parseTradingPeriodKey(params.get(paramName) ?? undefined);
      const nextPeriod = requestedPeriod ?? currentPeriod;
      setSelectedPeriodState((previous) =>
        previous.key === nextPeriod.key ? previous : nextPeriod,
      );
    };
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [currentPeriod, paramName]);

  const setSelectedPeriod = useCallback(
    (period: TradingPeriod) => {
      setSelectedPeriodState(period);
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (period.key === currentPeriod.key) {
        params.delete(paramName);
      } else {
        params.set(paramName, period.key);
      }
      const next = params.toString();
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      const nextUrl = `${pathname}${next ? `?${next}` : ""}${hash}`;
      window.history.replaceState(null, "", nextUrl);
    },
    [currentPeriod.key, paramName],
  );

  return {
    currentPeriod,
    selectedPeriod,
    selectedPeriodKey: selectedPeriod.key,
    setSelectedPeriod,
  };
}
