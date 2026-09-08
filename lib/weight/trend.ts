import type { WeightEntry } from "./types";

export type TrendPoint = {
  recordedAt: string;
  weightKg: number;
};

/**
 * Computes a trailing N-day moving average of weight entries.
 *
 * Not wired into the UI yet — the current iteration intentionally shows a
 * single raw weight series (see issue #6). This is exported so the chart
 * can later add a smoothed trend line without reshaping the data layer.
 */
export function getMovingAverage(entries: WeightEntry[], windowDays = 7): TrendPoint[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  return sorted.map((entry, index) => {
    const cutoff = new Date(entry.recordedAt).getTime() - windowMs;
    const windowEntries = sorted
      .slice(0, index + 1)
      .filter((candidate) => new Date(candidate.recordedAt).getTime() > cutoff);
    const average =
      windowEntries.reduce((sum, candidate) => sum + candidate.weightKg, 0) / windowEntries.length;

    return { recordedAt: entry.recordedAt, weightKg: average };
  });
}
