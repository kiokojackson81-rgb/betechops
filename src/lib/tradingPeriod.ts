export type TradingPeriod = {
  start: Date;
  end: Date;
  label: string;
  key: string; // ISO start_end
};

export function getJumiaWeeklyPeriodFor(date: Date): TradingPeriod {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay(): Sunday=0…Saturday=6. Jumia weeks start on Monday.
  const dayOfWeek = d.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const label = `${start.toISOString().split('T')[0]} – ${end.toISOString().split('T')[0]}`;
  const key = `${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}`;
  return { start, end, label, key };
}

export function getRecentJumiaWeeks(n: number): TradingPeriod[] {
  const out: TradingPeriod[] = [];
  const today = new Date();
  for (let i = 0; i < n; i += 1) {
    const ref = new Date(today);
    ref.setDate(ref.getDate() - i * 7);
    out.push(getJumiaWeeklyPeriodFor(ref));
  }
  return out;
}

export default getJumiaWeeklyPeriodFor;

const formatLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export function getTradingPeriodFor(date: Date): TradingPeriod {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day = d.getDate();

  let startYear: number;
  let startMonth: number;
  let endYear: number;
  let endMonth: number;

  if (day >= 25) {
    startYear = year;
    startMonth = month;
    // next month
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    // current period started last month
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }

  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);

  const label = `${formatLabel(start)} – ${formatLabel(end)}`;
  const key = `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`;

  return { start, end, label, key };
}

export function getRecentTradingPeriods(n: number): TradingPeriod[] {
  const periods: TradingPeriod[] = [];
  let cursor = getTradingPeriodFor(new Date());
  for (let i = 0; i < n; i++) {
    periods.push(cursor);
    const prevEnd = new Date(cursor.start.getTime() - 24 * 60 * 60 * 1000);
    cursor = getTradingPeriodFor(prevEnd);
  }
  return periods;
}
