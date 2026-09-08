import type { WeightEntry } from "./types";

/**
 * Historical weigh-ins imported from an earlier chat log. Only the date of
 * each measurement was preserved, not the exact clock time, so every entry
 * is normalized to a documented placeholder time of 12:00 Europe/Helsinki
 * (UTC+3, EEST — all listed dates fall within Finnish daylight saving time)
 * instead of inventing a precise timestamp.
 */
const HISTORICAL_PLACEHOLDER_TIME = "T12:00:00+03:00";

const RAW_HISTORICAL_WEIGHTS: [date: string, weightKg: number][] = [
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

export function getSeedWeightEntries(): WeightEntry[] {
  return RAW_HISTORICAL_WEIGHTS.map(([date, weightKg]) => ({
    id: `seed-${date}`,
    weightKg,
    recordedAt: `${date}${HISTORICAL_PLACEHOLDER_TIME}`,
  }));
}
