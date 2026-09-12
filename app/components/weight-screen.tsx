"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEntry,
  filterByPeriod,
  PERIODS,
  sortByTime,
  type Period,
  type WeightEntry,
} from "../lib/weight";
import { createCalorieEntry, type CalorieEntry } from "../lib/calorie";
import { formatDayMonth } from "../lib/date";
import { AddWeightForm } from "./add-weight-form";
import { AddCalorieForm } from "./add-calorie-form";
import { WeightChart } from "./weight-chart";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WEIGHTS_API = `${BASE_PATH}/api/weights`;
const CALORIES_API = `${BASE_PATH}/api/calories`;

/** Prefix a server-relative `imageUrl` (e.g. `/api/calories/{id}/image`) with
 * the app's base path so `<img src>` resolves under a reverse proxy. Optimistic
 * entries use an absolute `blob:` object URL instead, which must pass through
 * untouched. */
function imageSrc(imageUrl: string): string {
  return imageUrl.startsWith("/") ? `${BASE_PATH}${imageUrl}` : imageUrl;
}

export function WeightScreen() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [calories, setCalories] = useState<CalorieEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("All");
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [showCalorieForm, setShowCalorieForm] = useState(false);
  const [showWeight, setShowWeight] = useState(true);
  const [showCalories, setShowCalories] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [weightsRes, caloriesRes] = await Promise.all([
          fetch(WEIGHTS_API, { cache: "no-store", signal: controller.signal }),
          fetch(CALORIES_API, { cache: "no-store", signal: controller.signal }),
        ]);
        if (!weightsRes.ok) throw new Error(`HTTP ${weightsRes.status}`);
        if (!caloriesRes.ok) throw new Error(`HTTP ${caloriesRes.status}`);
        const weightsData = (await weightsRes.json()) as { entries: WeightEntry[] };
        const caloriesData = (await caloriesRes.json()) as { entries: CalorieEntry[] };
        setEntries(sortByTime(weightsData.entries));
        setCalories(sortByTime(caloriesData.entries));
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("failed to load history", cause);
        setError("Couldn't load your history. Refresh to try again.");
      } finally {
        if (!controller.signal.aborted) setReady(true);
      }
    })();
    return () => controller.abort();
  }, []);

  const handleAddWeight = useCallback(async (kg: number, at: Date) => {
    const optimistic = createEntry(kg, at);
    setEntries((prev) => sortByTime([...prev, optimistic]));
    setShowWeightForm(false);
    setPeriod("All");
    setError(null);
    try {
      const response = await fetch(WEIGHTS_API, {
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
  }, []);

  const handleAddCalories = useCallback(async (kcal: number, at: Date, image: File | null) => {
    const optimistic = createCalorieEntry(kcal, at, image ? URL.createObjectURL(image) : null);
    setCalories((prev) => sortByTime([...prev, optimistic]));
    setShowCalorieForm(false);
    setPeriod("All");
    setError(null);
    try {
      const form = new FormData();
      form.set("kcal", String(optimistic.kcal));
      form.set("at", optimistic.at);
      if (image) form.set("image", image);
      const response = await fetch(CALORIES_API, { method: "POST", body: form });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { entry } = (await response.json()) as { entry: CalorieEntry };
      setCalories((prev) => sortByTime(prev.map((item) => (item.id === optimistic.id ? entry : item))));
    } catch (cause) {
      console.error("failed to save calories", cause);
      setCalories((prev) => prev.filter((item) => item.id !== optimistic.id));
      setError("Couldn't save calories. Try again.");
    } finally {
      if (optimistic.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(optimistic.imageUrl);
    }
  }, []);

  const visible = useMemo(() => filterByPeriod(entries, period), [entries, period]);
  const visibleCalories = useMemo(() => filterByPeriod(calories, period), [calories, period]);
  const thumbnails = useMemo(
    () => visibleCalories.filter((entry) => entry.imageUrl),
    [visibleCalories],
  );

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
            className="wc-btn wc-btn-ghost wc-add"
            onClick={() => {
              setShowCalorieForm((open) => !open);
              setShowWeightForm(false);
            }}
          >
            {showCalorieForm ? "Close" : "＋ Add calories"}
          </button>
          <button
            type="button"
            className="wc-btn wc-btn-primary wc-add"
            onClick={() => {
              setShowWeightForm((open) => !open);
              setShowCalorieForm(false);
            }}
          >
            {showWeightForm ? "Close" : "＋ Add weight"}
          </button>
        </div>
      </header>

      {showWeightForm && (
        <AddWeightForm onAdd={handleAddWeight} onClose={() => setShowWeightForm(false)} />
      )}
      {showCalorieForm && (
        <AddCalorieForm onAdd={handleAddCalories} onClose={() => setShowCalorieForm(false)} />
      )}

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
        <WeightChart
          entries={visible}
          calories={visibleCalories.map((entry) => ({ id: entry.id, at: entry.at, kcal: entry.kcal }))}
          showWeight={showWeight}
          showCalories={showCalories}
          onToggleWeight={() => setShowWeight((v) => !v)}
          onToggleCalories={() => setShowCalories((v) => !v)}
        />
      ) : (
        <div className="wc-chart wc-chart-empty" aria-hidden />
      )}

      {showCalories && thumbnails.length > 0 && (
        <div className="wc-thumbnails" role="list" aria-label="Meal photos">
          {thumbnails.map((entry) => (
            <figure key={entry.id} className="wc-thumbnail" role="listitem">
              {/* eslint-disable-next-line @next/next/no-img-element -- served
                  from our own API, not the Next.js image optimizer's domains */}
              <img src={imageSrc(entry.imageUrl!)} alt={`${entry.kcal} kcal`} loading="lazy" />
              <figcaption>
                {formatDayMonth(new Date(entry.at))} · {entry.kcal} kcal
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
