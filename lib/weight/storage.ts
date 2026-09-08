import { getSeedWeightEntries } from "./seed-data";
import type { WeightEntry } from "./types";

const STORAGE_KEY = "calify.weightEntries.v1";

/**
 * Weight entries live in localStorage and are exposed to React through a
 * tiny external store (`useSyncExternalStore`). This keeps the read
 * SSR-safe and avoids synchronising state inside an effect.
 */
const listeners = new Set<() => void>();

// A stable, cached snapshot. `useSyncExternalStore` requires that
// `getSnapshot` returns the same reference until the data actually changes.
let cache: WeightEntry[] | null = null;

const EMPTY: WeightEntry[] = [];

function sortByRecordedAt(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}

/**
 * Reads entries from localStorage. On first run (nothing stored yet) the
 * historical seed data is written and returned so the graph has real data
 * to render immediately.
 */
function readFromStorage(): WeightEntry[] {
  if (typeof window === "undefined") return EMPTY;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = sortByRecordedAt(getSeedWeightEntries());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as WeightEntry[];
    return sortByRecordedAt(parsed);
  } catch {
    // Corrupt data shouldn't crash the page; fall back to an empty log.
    return EMPTY;
  }
}

export function subscribeWeightEntries(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWeightEntriesSnapshot(): WeightEntry[] {
  if (cache === null) cache = readFromStorage();
  return cache;
}

export function getServerWeightEntriesSnapshot(): WeightEntry[] {
  return EMPTY;
}

export function addWeightEntry(weightKg: number, recordedAt: string): void {
  const next = sortByRecordedAt([
    ...getWeightEntriesSnapshot(),
    { id: crypto.randomUUID(), weightKg, recordedAt },
  ]);

  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}
