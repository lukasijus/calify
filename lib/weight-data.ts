/**
 * Weight tracking data layer.
 *
 * A single weight series is persisted in `localStorage`. Entries are stored with
 * an ISO-like local timestamp (`at`). For the historical import below the
 * original chat log only preserved the measurement *date*, not the clock time,
 * so every historical entry is normalised to a documented local-time placeholder
 * of 12:00 (noon, Europe/Helsinki) rather than pretending we know the real time.
 * `source: "historical"` marks those rows so a future iteration can treat them
 * differently (e.g. a 7-day moving-average trend line over raw weigh-ins).
 */

export type WeightSource = "historical" | "manual";

export interface WeightEntry {
  id: string;
  /** Local timestamp, e.g. `2026-09-08T12:00` or `2026-09-09T07:15`. */
  at: string;
  /** Weight in kilograms. */
  kg: number;
  source: WeightSource;
}

export const STORAGE_KEY = "calify.weight.entries.v1";

/** Placeholder clock time for date-only historical imports (local time). */
export const HISTORICAL_PLACEHOLDER_TIME = "12:00";

/**
 * Measured historical weigh-ins (kg) keyed by date. Imported verbatim from the
 * issue; do not thin or sample these.
 */
const HISTORICAL_KG: Record<string, number> = {
  "2026-06-25": 101.0,
  "2026-06-26": 100.75,
  "2026-06-27": 100.6,
  "2026-06-28": 101.75,
  "2026-06-29": 102.25,
  "2026-06-30": 101.1,
  "2026-07-01": 100.5,
  "2026-07-02": 100.1,
  "2026-07-04": 99.4,
  "2026-07-05": 99.1,
  "2026-07-06": 99.25,
  "2026-07-07": 99.4,
  "2026-07-08": 99.4,
  "2026-07-09": 99.5,
  "2026-07-10": 99.65,
  "2026-07-13": 99.6,
  "2026-07-14": 99.4,
  "2026-07-15": 99.2,
  "2026-07-18": 98.2,
  "2026-07-21": 98.1,
  "2026-07-22": 97.7,
  "2026-07-23": 98.1,
  "2026-07-24": 98.7,
  "2026-07-25": 97.8,
  "2026-07-26": 97.6,
  "2026-07-27": 97.6,
  "2026-07-28": 97.5,
  "2026-07-29": 97.1,
  "2026-07-31": 97.4,
  "2026-08-01": 96.9,
  "2026-08-03": 96.6,
  "2026-08-04": 96.8,
  "2026-08-10": 98.0,
  "2026-08-11": 97.4,
  "2026-08-12": 96.1,
  "2026-08-18": 97.5,
  "2026-08-19": 97.4,
  "2026-08-20": 96.5,
  "2026-08-22": 97.9,
  "2026-08-24": 97.1,
  "2026-08-29": 96.1,
  "2026-08-31": 96.0,
  "2026-09-04": 96.0,
  "2026-09-05": 95.5,
  "2026-09-07": 95.7,
  "2026-09-08": 95.7,
};

export function seedEntries(): WeightEntry[] {
  return Object.entries(HISTORICAL_KG).map(([date, kg]) => ({
    id: `seed-${date}`,
    at: `${date}T${HISTORICAL_PLACEHOLDER_TIME}`,
    kg,
    source: "historical" as const,
  }));
}

/** Parse an entry timestamp as local time. */
export function entryDate(entry: WeightEntry): Date {
  return new Date(entry.at);
}

export function sortEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort(
    (a, b) => entryDate(a).getTime() - entryDate(b).getTime(),
  );
}

function isWeightEntry(value: unknown): value is WeightEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.at === "string" &&
    typeof v.kg === "number" &&
    Number.isFinite(v.kg) &&
    (v.source === "historical" || v.source === "manual")
  );
}

/*
 * External store bound to `useSyncExternalStore`. Keeping persistence outside
 * React (rather than hydrating via an effect) avoids a `setState`-in-effect
 * round-trip and lets SSR render the seed series while the client swaps in the
 * locally stored data without a hydration mismatch.
 */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeEntries(listener: () => void): () => void {
  // `subscribe` runs from an effect, so it's the right place for the one-time
  // side effect of persisting the seed series on a fresh device.
  if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === null) {
    saveEntries(seedEntries());
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let serverSnapshot: WeightEntry[] | null = null;

/** Stable seed snapshot used for SSR and the initial hydration pass. */
export function getEntriesServerSnapshot(): WeightEntry[] {
  serverSnapshot ??= sortEntries(seedEntries());
  return serverSnapshot;
}

let clientSnapshot: WeightEntry[] | null = null;
let clientSnapshotRaw: string | null = null;

function parseRaw(raw: string | null): WeightEntry[] {
  try {
    const parsed = raw === null ? null : JSON.parse(raw);
    if (!Array.isArray(parsed)) return sortEntries(seedEntries());
    return sortEntries(parsed.filter(isWeightEntry));
  } catch {
    return sortEntries(seedEntries());
  }
}

/**
 * Read the persisted series, returning a *stable* reference while the stored
 * JSON is unchanged so `useSyncExternalStore` doesn't loop. Before the store is
 * seeded (see `subscribeEntries`) this falls back to the seed series so SSR and
 * the first client render agree.
 */
export function getEntriesSnapshot(): WeightEntry[] {
  if (typeof window === "undefined") return getEntriesServerSnapshot();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return getEntriesServerSnapshot();
  if (raw === clientSnapshotRaw && clientSnapshot !== null) {
    return clientSnapshot;
  }
  clientSnapshotRaw = raw;
  clientSnapshot = parseRaw(raw);
  return clientSnapshot;
}

export function saveEntries(entries: WeightEntry[]): void {
  if (typeof window === "undefined") return;
  const sorted = sortEntries(entries);
  const raw = JSON.stringify(sorted);
  window.localStorage.setItem(STORAGE_KEY, raw);
  clientSnapshot = sorted;
  clientSnapshotRaw = raw;
  emit();
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** `datetime-local` value for "now", trimmed to minutes. */
export function nowLocalInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}
