/**
 * Weight tracking data model + client-side helpers.
 *
 * Entries are persisted server-side in Postgres (see `app/lib/db.ts` and the
 * `/api/weights` route). This module holds the shared shape and the pure
 * math/formatting the chart needs. The shape is kept deliberately small so it
 * can grow later (goal weight, milestones, ...) without a migration.
 */

export type WeightSource = "manual" | "import";

export type WeightEntry = {
  /** Stable id. Seeded entries use a deterministic `seed-<date>` id. */
  id: string;
  /** Body weight in kilograms. */
  kg: number;
  /**
   * ISO 8601 timestamp of the measurement.
   *
   * Manual entries store the real local time the user picked. Historical
   * imports only have a date, so they are normalized to a documented local-time
   * placeholder of 12:00 (see `weight-seed.ts`). The value is stored without a
   * timezone offset so it is always read back in the viewer's local time.
   */
  at: string;
  source: WeightSource;
};

export function sortByTime(entries: readonly WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export type Period = "1M" | "3M" | "6M" | "All";

export const PERIODS: readonly Period[] = ["1M", "3M", "6M", "All"];

const PERIOD_DAYS: Record<Exclude<Period, "All">, number> = {
  "1M": 30,
  "3M": 91,
  "6M": 182,
};

/**
 * Filter entries to a period, anchored to the most recent entry rather than
 * "now" (the sample data lives in the future and, more importantly, users care
 * about the window ending at their latest weigh-in).
 */
export function filterByPeriod(entries: readonly WeightEntry[], period: Period): WeightEntry[] {
  const sorted = sortByTime(entries);
  if (period === "All" || sorted.length === 0) return sorted;
  const anchor = Date.parse(sorted[sorted.length - 1].at);
  const cutoff = anchor - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return sorted.filter((entry) => Date.parse(entry.at) >= cutoff);
}

/**
 * 7-day moving average, sampled at each entry. Not rendered yet, but the chart
 * already accepts a `trend` series so this can be switched on without touching
 * the page. Daily weigh-ins are noisy; this is the smoother signal.
 */
export function movingAverage(
  entries: readonly WeightEntry[],
  windowDays = 7,
): { at: string; kg: number }[] {
  const sorted = sortByTime(entries);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return sorted.map((entry, index) => {
    const end = Date.parse(entry.at);
    let sum = 0;
    let count = 0;
    for (let i = index; i >= 0; i--) {
      const t = Date.parse(sorted[i].at);
      if (end - t > windowMs) break;
      sum += sorted[i].kg;
      count += 1;
    }
    return { at: entry.at, kg: count > 0 ? sum / count : entry.kg };
  });
}

export function createEntry(kg: number, at: Date, source: WeightSource = "manual"): WeightEntry {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kg: Math.round(kg * 100) / 100,
    at: toLocalIso(at),
    source,
  };
}

/** ISO-like string without timezone, so it round-trips in local time. */
export function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`
  );
}

/** Value for an `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`). */
export function toDateTimeLocalValue(date: Date): string {
  return toLocalIso(date).slice(0, 16);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Compact axis/tooltip label, e.g. `8 Sep`. Fixed strings so it matches on
 * server and client regardless of the runtime's ICU locale data. */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
