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
import { AddCaloriesForm, CALORIES_API } from "./add-calories-form";
import type { CalorieEntry } from "../lib/calorie";
import { AddWeightForm } from "./add-weight-form";
import { WeightChart } from "./weight-chart";

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/weights`;

export function WeightScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [calories, setCalories] = useState<CalorieEntry[]>([]);
  const [calorieError, setCalorieError] = useState<string | null>(null);
  const [showCaloriesForm, setShowCaloriesForm] = useState(false);
  const [showWeight, setShowWeight] = useState(true);
  const [showCalories, setShowCalories] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(CALORIES_API, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { entries: CalorieEntry[] };
        setCalories(previous => sortByTime([
          ...new Map([...data.entries, ...previous].map(entry => [entry.id, entry])).values(),
        ]));
      } catch {
        if (!controller.signal.aborted) setCalorieError("Couldn't load calories. Refresh to try again.");
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

  const activity = useMemo(() => filterByPeriod([...entries, ...calories], period), [entries, calories, period]);
  const visibleIds = useMemo(() => new Set(activity.map(e => e.id)), [activity]);
  const visible = useMemo(() => entries.filter(e => visibleIds.has(e.id)), [entries, visibleIds]);
  const visibleCalories = useMemo(() => calories.filter(e => visibleIds.has(e.id)), [calories, visibleIds]);
  const firstDay = activity[0]?.at.slice(0, 10);
  const lastDay = activity[activity.length - 1]?.at.slice(0, 10);
  const day = selectedDay && firstDay && lastDay && selectedDay >= firstDay && selectedDay <= lastDay ? selectedDay : lastDay;
  const dayCalories = visibleCalories.filter(e => e.at.startsWith(day ?? "invalid"));
  const dayWeights = visible.filter(e => e.at.startsWith(day ?? "invalid"));
  function shiftDay(offset: number) {
    if (!day) return;
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + offset);
    setSelectedDay(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
  }

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
        <div className="wc-header-actions">
        <button
          type="button"
          className="wc-btn wc-btn-primary wc-add"
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? "Close" : "＋ Add weight"}
        </button>
        <button type="button" className="wc-btn wc-btn-primary" onClick={() => setShowCaloriesForm(true)}>＋ Add calories</button>
        </div>
      </header>

      {showForm && <AddWeightForm onAdd={handleAdd} onClose={() => setShowForm(false)} />}

      {showCaloriesForm && <AddCaloriesForm onClose={() => setShowCaloriesForm(false)} onAdd={entry => {
        setCalories(prev => sortByTime([...prev, entry]));
        setPeriod("All");
        setSelectedDay(entry.at.slice(0, 10));
      }} />}
      {calorieError && <p className="wc-form-error" role="alert">{calorieError}</p>}
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

      <div className="wc-legend" role="group" aria-label="Show graphs">
        <label><input type="checkbox" checked={showWeight} onChange={e => setShowWeight(e.target.checked)} /><span className="wc-legend-weight">●</span> Weight (kg)</label>
        <label><input type="checkbox" checked={showCalories} onChange={e => setShowCalories(e.target.checked)} /><span className="wc-legend-calories">●</span> Calories (kcal)</label>
      </div>
      {ready ? (
        <WeightChart entries={visible} calories={visibleCalories} showWeight={showWeight} showCalories={showCalories} onSelectDay={setSelectedDay} />
      ) : (
        <div className="wc-chart wc-chart-empty" aria-hidden />
      )}
      {day && <>
        <div className="wc-day-nav" aria-label="Browse days">
          <button type="button" className="wc-btn wc-btn-ghost" aria-label="Previous day" disabled={day === firstDay} onClick={() => shiftDay(-1)}>←</button>
          <p aria-live="polite">{day} · {dayCalories.length ? `${dayCalories.reduce((sum, e) => sum + e.kcal, 0)} kcal` : "No kcal logged"} · {dayWeights.length ? `${dayWeights[dayWeights.length - 1].kg} kg` : "No weight logged"}</p>
          <button type="button" className="wc-btn wc-btn-ghost" aria-label="Next day" disabled={day === lastDay} onClick={() => shiftDay(1)}>→</button>
        </div>
        <label className="wc-field">Browse date<input type="date" min={firstDay} max={lastDay} value={day} onChange={e => setSelectedDay(e.target.value)} /></label>
        <div className="wc-thumbnails">
          {dayCalories.filter(e => e.hasImage).map(entry => <a key={entry.id} href={`${CALORIES_API}/${entry.id}/image`} target="_blank" rel="noreferrer">
            {/* Original uploads are served directly; no external image optimizer required. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${CALORIES_API}/${entry.id}/image`} alt={`${entry.kcal} kcal on ${day} at ${entry.at.slice(11, 16)}`} width={100} height={100} loading="lazy" />
          </a>)}
        </div>
      </>}
    </section>
  );
}
