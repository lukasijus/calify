"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createEntry,
  filterByPeriod,
  isStoreInitialized,
  loadEntries,
  PERIODS,
  saveEntries,
  sortByTime,
  formatDayMonth,
  type Period,
  type WeightEntry,
} from "../lib/weight";
import { buildSeedEntries } from "../lib/weight-seed";
import { AddWeightForm } from "./add-weight-form";
import { WeightChart } from "./weight-chart";

export function WeightScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState<Period>("All");
  const [showForm, setShowForm] = useState(false);

  // Load persisted entries once, seeding the historical import on first run.
  useEffect(() => {
    if (isStoreInitialized()) {
      setEntries(sortByTime(loadEntries()));
    } else {
      const seeded = sortByTime(buildSeedEntries());
      saveEntries(seeded);
      setEntries(seeded);
    }
    setReady(true);
  }, []);

  const persist = (next: WeightEntry[]) => {
    const sorted = sortByTime(next);
    setEntries(sorted);
    saveEntries(sorted);
  };

  const handleAdd = (kg: number, at: Date) => {
    persist([...entries, createEntry(kg, at)]);
    setShowForm(false);
    setPeriod("All");
  };

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
