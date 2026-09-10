"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEntry,
  filterByPeriod,
  PERIODS,
  sortByTime,
  formatDayMonth,
  type Period,
  type WeightEntry,
} from "../lib/weight";
import { AddWeightForm } from "./add-weight-form";
import { WeightChart } from "./weight-chart";

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/weights`;

export function WeightScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("All");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(API, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { entries: WeightEntry[] };
        setEntries(sortByTime(data.entries));
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("failed to load weight history", cause);
        setError("Couldn't load your weight history. Refresh to try again.");
      } finally {
        if (!controller.signal.aborted) setReady(true);
      }
    })();
    return () => controller.abort();
  }, []);

  const handleAdd = useCallback(
    async (kg: number, at: Date) => {
      const optimistic = createEntry(kg, at);
      setEntries((prev) => sortByTime([...prev, optimistic]));
      setShowForm(false);
      setPeriod("All");
      setError(null);
      try {
        const response = await fetch(API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kg: optimistic.kg, at: optimistic.at }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { entry } = (await response.json()) as { entry: WeightEntry };
        setEntries((prev) => sortByTime(prev.map((item) => (item.id === optimistic.id ? entry : item))));
      } catch (cause) {
        console.error("failed to save weigh-in", cause);
        setEntries((prev) => prev.filter((item) => item.id !== optimistic.id));
        setError("Couldn't save that weigh-in. Try again.");
      }
    },
    [],
  );

  const visible = useMemo(() => filterByPeriod(entries, period), [entries, period]);

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const current = entries[entries.length - 1];
    const first = visible[0] ?? current;
    const change = current.kg - first.kg;
    return {
      current: current.kg,
      change,
      sinceLabel: formatDayMonth(new Date(first.at)),
      samePoint: visible.length <= 1,
    };
  }, [entries, visible]);

  return (
    <section className="wc" aria-busy={!ready}>
      <header className="wc-header">
        <div className="wc-metrics">
          <h1 className="wc-eyebrow">Weight</h1>
          <p className="wc-current">
            {stats ? stats.current.toFixed(1) : "—"}
            <span className="wc-current-unit">kg</span>
          </p>
          {stats && !stats.samePoint && (
            <p
              className={`wc-change ${
                stats.change < 0 ? "is-down" : stats.change > 0 ? "is-up" : "is-flat"
              }`}
            >
              {stats.change < 0 ? "↓" : stats.change > 0 ? "↑" : "→"}{" "}
              {Math.abs(stats.change).toFixed(1)} kg since {stats.sinceLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          className="wc-btn wc-btn-primary wc-add"
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? "Close" : "＋ Add weight"}
        </button>
      </header>

      {showForm && <AddWeightForm onAdd={handleAdd} onClose={() => setShowForm(false)} />}

      {error && (
        <p className="wc-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="wc-periods" role="group" aria-label="Time range">
        {PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={period === option}
            className={`wc-period ${period === option ? "is-active" : ""}`}
            onClick={() => setPeriod(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {ready ? (
        <WeightChart entries={visible} />
      ) : (
        <div className="wc-chart wc-chart-empty" aria-hidden />
      )}
    </section>
  );
}
