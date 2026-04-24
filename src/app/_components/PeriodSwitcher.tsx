"use client";

import Button from "@/app/_components/Button";
import {
  getNextTradingPeriod,
  getPreviousTradingPeriod,
  type TradingPeriod,
} from "@/lib/tradingPeriod";

export default function PeriodSwitcher({
  currentPeriod,
  selectedPeriod,
  onSelectPeriod,
}: {
  currentPeriod: TradingPeriod;
  selectedPeriod: TradingPeriod;
  onSelectPeriod: (period: TradingPeriod) => void;
}) {
  const previousPeriod = getPreviousTradingPeriod(selectedPeriod);
  const viewingCurrent = selectedPeriod.key === currentPeriod.key;
  const nextPeriod = viewingCurrent ? null : getNextTradingPeriod(selectedPeriod);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => onSelectPeriod(previousPeriod)}
        className="px-4 text-sm"
      >
        View previous period
      </Button>
      {nextPeriod && (
        <Button
          variant="secondary"
          onClick={() => onSelectPeriod(nextPeriod)}
          className="px-4 text-sm"
        >
          View next period
        </Button>
      )}
      {!viewingCurrent && (
        <Button
          variant="secondary"
          onClick={() => onSelectPeriod(currentPeriod)}
          className="px-4 text-sm"
        >
          Return to current period
        </Button>
      )}
    </div>
  );
}
