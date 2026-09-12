/**
 * Calorie tracking data model + client-side helpers.
 *
 * Mirrors `app/lib/weight.ts`: entries are persisted server-side in Postgres
 * (see `app/lib/db.ts` and the `/api/calories` route). A calorie entry may
 * optionally carry a photo, served separately from `/api/calories/{id}/image`
 * so listing entries stays cheap.
 */

import { toLocalIso } from "./date";

export type CalorieSource = "manual";

export type CalorieEntry = {
  /** Stable id. */
  id: string;
  /** Energy in kilocalories. */
  kcal: number;
  /** Local-wall-clock ISO timestamp, same convention as `WeightEntry.at`. */
  at: string;
  /** `/api/calories/{id}/image` when a photo was attached, otherwise null. */
  imageUrl: string | null;
  source: CalorieSource;
};

/** Mirrors the "Increase the upload limit, maybe to 8MB per picture" request
 * in issue #19 (the original 2 MB cap was too small for phone camera photos). */
export const MAX_CALORIE_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_CALORIE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function createCalorieEntry(
  kcal: number,
  at: Date,
  imageUrl: string | null = null,
): CalorieEntry {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kcal: Math.round(kcal),
    at: toLocalIso(at),
    imageUrl,
    source: "manual",
  };
}
