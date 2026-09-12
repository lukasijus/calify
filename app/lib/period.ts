/**
 * Time-range filtering shared by every chart (weight, calories, ...). Kept
 * generic over anything with an `at` timestamp so new entry types don't need
 * their own copy.
 */

export type Period = "1M" | "3M" | "6M" | "All";

export const PERIODS: readonly Period[] = ["1M", "3M", "6M", "All"];

const PERIOD_DAYS: Record<Exclude<Period, "All">, number> = {
  "1M": 30,
  "3M": 91,
  "6M": 182,
};

export function sortByTime<T extends { at: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * Filter entries to a period, anchored to the most recent entry rather than
 * "now" (the sample data lives in the future and, more importantly, users care
 * about the window ending at their latest entry).
 */
export function filterByPeriod<T extends { at: string }>(
  entries: readonly T[],
  period: Period,
): T[] {
  const sorted = sortByTime(entries);
  if (period === "All" || sorted.length === 0) return sorted;
  const anchor = Date.parse(sorted[sorted.length - 1].at);
  const cutoff = anchor - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return sorted.filter((entry) => Date.parse(entry.at) >= cutoff);
}
