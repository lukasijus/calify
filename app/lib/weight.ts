/**
 * Weight tracking data model + client-side helpers.
 *
 * Entries are persisted server-side in Postgres (see `app/lib/db.ts` and the
 * `/api/weights` route). This module holds the shared shape and the pure
 * math/formatting the chart needs. The shape is kept deliberately small so it
 * can grow later (goal weight, milestones, ...) without a migration.
 */

import { toLocalIso } from "./date";
import { sortByTime } from "./period";

// Date and time-range helpers are shared with the calories entries (see
// `app/lib/calorie.ts`); re-exported here so existing imports keep working.
export { toLocalIso, toDateTimeLocalValue, formatDayMonth } from "./date";
export { type Period, PERIODS, sortByTime, filterByPeriod } from "./period";

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
