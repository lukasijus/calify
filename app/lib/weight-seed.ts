import type { WeightEntry } from "./weight";

/**
 * Historical weigh-ins imported from the original chat log (issue #6).
 *
 * The log only preserved the **date** for these entries, not the clock time.
 * We therefore normalize every historical import to a fixed local-time
 * placeholder of 12:00 (noon). Timezone context for the original measurements
 * was Europe/Helsinki; the placeholder is stored without an offset so the graph
 * always renders it at local noon on the right calendar day.
 */
export const HISTORICAL_PLACEHOLDER_TIME = "12:00";

const HISTORICAL: ReadonlyArray<readonly [date: string, kg: number]> = [
  ["2026-06-25", 101.0],
  ["2026-06-26", 100.75],
  ["2026-06-27", 100.6],
  ["2026-06-28", 101.75],
  ["2026-06-29", 102.25],
  ["2026-06-30", 101.1],
  ["2026-07-01", 100.5],
  ["2026-07-02", 100.1],
  ["2026-07-04", 99.4],
  ["2026-07-05", 99.1],
  ["2026-07-06", 99.25],
  ["2026-07-07", 99.4],
  ["2026-07-08", 99.4],
  ["2026-07-09", 99.5],
  ["2026-07-10", 99.65],
  ["2026-07-13", 99.6],
  ["2026-07-14", 99.4],
  ["2026-07-15", 99.2],
  ["2026-07-18", 98.2],
  ["2026-07-21", 98.1],
  ["2026-07-22", 97.7],
  ["2026-07-23", 98.1],
  ["2026-07-24", 98.7],
  ["2026-07-25", 97.8],
  ["2026-07-26", 97.6],
  ["2026-07-27", 97.6],
  ["2026-07-28", 97.5],
  ["2026-07-29", 97.1],
  ["2026-07-31", 97.4],
  ["2026-08-01", 96.9],
  ["2026-08-03", 96.6],
  ["2026-08-04", 96.8],
  ["2026-08-10", 98.0],
  ["2026-08-11", 97.4],
  ["2026-08-12", 96.1],
  ["2026-08-18", 97.5],
  ["2026-08-19", 97.4],
  ["2026-08-20", 96.5],
  ["2026-08-22", 97.9],
  ["2026-08-24", 97.1],
  ["2026-08-29", 96.1],
  ["2026-08-31", 96.0],
  ["2026-09-04", 96.0],
  ["2026-09-05", 95.5],
  ["2026-09-07", 95.7],
  ["2026-09-08", 95.7],
];

export function buildSeedEntries(): WeightEntry[] {
  return HISTORICAL.map(([date, kg]) => ({
    id: `seed-${date}`,
    kg,
    at: `${date}T${HISTORICAL_PLACEHOLDER_TIME}:00.000`,
    source: "import" as const,
  }));
}
