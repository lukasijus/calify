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
import type { CalorieEntry } from "../lib/calories";
import { AddCaloriesForm } from "./add-calories-form";
import { AddWeightForm } from "./add-weight-form";
import { WeightChart } from "./weight-chart";

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/weights`;

const CALORIES_API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/calories`;

export function WeightScreen() {
  const [calories, setCalories] = useState<CalorieEntry[]>([]);
  const [showCaloriesForm, setShowCaloriesForm] = useState(false);
  const [showWeight, setShowWeight] = useState(true);
  const [showCalories, setShowCalories] = useState(true);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("All");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const results = await Promise.allSettled([
          fetch(API, { cache: "no-store", signal: controller.signal }).then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json() as { entries: WeightEntry[] };
            setEntries(sortByTime(data.entries));
          }),
          fetch(CALORIES_API, { cache: "no-store", signal: controller.signal }).then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json() as { entries: CalorieEntry[] };
            setCalories(sortByTime(data.entries));
          }),
        ]);
        if (results.some((result) => result.status === "rejected")) throw new Error("History unavailable");
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("failed to load weight history", cause);
        setError("Couldn't load all your history. Refresh to try again.");
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

  const handleAddCalories = async (kcal: number, at: string, image: string | null) => {
    const response = await fetch(CALORIES_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kcal, at, image }),
    });
    if (!response.ok) throw new Error("Couldn't save calories. Try again.");
    const { entry } = await response.json() as { entry: CalorieEntry };
    setCalories((previous) => sortByTime([...previous, entry]));
    setPeriod("All");
    setShowCalories(true);
  };

  const anchor = Math.max(0, ...entries.map((e) => Date.parse(e.at)), ...calories.map((e) => Date.parse(e.at)));
  const visible = useMemo(() => filterByPeriod(entries, period, anchor), [entries, period, anchor]);
  const visibleCalories = useMemo(() => filterByPeriod(calories, period, anchor), [calories, period, anchor]);

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
        <div className="wc-add-actions">
        <button type="button" className="wc-btn wc-btn-primary" onClick={() => setShowCaloriesForm(true)}>＋ Add calories</button>
        <button
          type="button"
          className="wc-btn wc-btn-primary wc-add"
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? "Close" : "＋ Add weight"}
        </button>
        </div>
      </header>

      {showCaloriesForm && <AddCaloriesForm onAdd={handleAddCalories} onClose={() => setShowCaloriesForm(false)} />}

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

      <div className="wc-legend" role="group" aria-label="Visible graphs">
        <label><input type="checkbox" checked={showWeight} onChange={(event) => setShowWeight(event.target.checked)} /><span className="wc-legend-line" />Weight (kg)</label>
        <label><input type="checkbox" checked={showCalories} onChange={(event) => setShowCalories(event.target.checked)} /><span className="wc-legend-line is-calories" />Calories (kcal/day)</label>
      </div>

      {ready ? (
        <WeightChart entries={visible} calories={visibleCalories} showWeight={showWeight} showCalories={showCalories} />
      ) : (
        <div className="wc-chart wc-chart-empty" aria-hidden />
      )}
    </section>
  );
}
