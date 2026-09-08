import type { WeightEntry, WeightPeriod } from "./types";

const PERIOD_DAYS: Record<Exclude<WeightPeriod, "ALL">, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
};

/** Filters entries to those within the selected period, ending "now". */
export function filterByPeriod(entries: WeightEntry[], period: WeightPeriod): WeightEntry[] {
  if (period === "ALL") return entries;

  const days = PERIOD_DAYS[period];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => new Date(entry.recordedAt).getTime() >= cutoff);
}
