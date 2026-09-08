"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addWeightEntry,
  getServerWeightEntriesSnapshot,
  getWeightEntriesSnapshot,
  subscribeWeightEntries,
} from "@/lib/weight/storage";

// No-op subscribe: the hydration flag never changes after the first
// client render, so there is nothing to subscribe to.
const subscribeNever = () => () => {};

export function useWeightEntries() {
  const entries = useSyncExternalStore(
    subscribeWeightEntries,
    getWeightEntriesSnapshot,
    getServerWeightEntriesSnapshot,
  );

  // `true` during SSR and the initial hydration render, `false` afterwards.
  // Lets the UI show a skeleton until localStorage has been read on the client.
  const isLoading = useSyncExternalStore(
    subscribeNever,
    () => false,
    () => true,
  );

  const addEntry = useCallback((weightKg: number, recordedAt: string) => {
    addWeightEntry(weightKg, recordedAt);
  }, []);

  return { entries, addEntry, isLoading };
}
