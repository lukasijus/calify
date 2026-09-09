"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import styles from "./page.module.css";
import WeightChart from "./weight-chart";
import {
  entryDate,
  getEntriesServerSnapshot,
  getEntriesSnapshot,
  makeId,
  nowLocalInputValue,
  saveEntries,
  subscribeEntries,
  type WeightEntry,
} from "@/lib/weight-data";

type Period = "1M" | "3M" | "6M" | "All";

const PERIODS: Period[] = ["1M", "3M", "6M", "All"];
const PERIOD_DAYS: Record<Exclude<Period, "All">, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
};
const PERIOD_WORDS: Record<Period, string> = {
  "1M": "the last month",
  "3M": "the last 3 months",
  "6M": "the last 6 months",
  All: "all time",
};

function formatFull(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function filterByPeriod(entries: WeightEntry[], period: Period): WeightEntry[] {
  if (period === "All" || entries.length === 0) return entries;
  const latest = entryDate(entries[entries.length - 1]).getTime();
  const cutoff = latest - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  const within = entries.filter((e) => entryDate(e).getTime() >= cutoff);
  return within.length >= 2 ? within : entries;
}

export default function Page() {
  const entries = useSyncExternalStore(
    subscribeEntries,
    getEntriesSnapshot,
    getEntriesServerSnapshot,
  );
  const [period, setPeriod] = useState<Period>("All");
  const [showForm, setShowForm] = useState(false);
  const [kg, setKg] = useState("");
  const [at, setAt] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(
    () => filterByPeriod(entries, period),
    [entries, period],
  );

  const current = entries.length > 0 ? entries[entries.length - 1] : null;
  const delta =
    visible.length >= 2 ? visible[visible.length - 1].kg - visible[0].kg : 0;

  function openForm() {
    setAt(nowLocalInputValue());
    setKg("");
    setError("");
    setShowForm((s) => !s);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number.parseFloat(kg.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || value > 700) {
      setError("Enter a weight in kg between 0 and 700.");
      return;
    }
    if (!at) {
      setError("Pick a date and time.");
      return;
    }
    saveEntries([
      ...entries,
      { id: makeId(), at, kg: Math.round(value * 100) / 100, source: "manual" },
    ]);
    setShowForm(false);
    setError("");
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.eyebrow}>Weight</h1>
            <p className={styles.current}>
              {current ? `${current.kg.toFixed(1)} kg` : "—"}
            </p>
            {current && (
              <p className={styles.trend}>
                {visible.length >= 2 ? (
                  <>
                    <span
                      className={delta <= 0 ? styles.trendDown : styles.trendUp}
                    >
                      {delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)} kg
                    </span>{" "}
                    over {PERIOD_WORDS[period]}
                  </>
                ) : (
                  <>Last weigh-in {formatFull(entryDate(current))}</>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            className={`${styles.addButton} ${showForm ? styles.addButtonActive : ""}`}
            onClick={openForm}
          >
            {showForm ? "Close" : "Add weight"}
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="kg">
                Weight (kg)
              </label>
              <input
                id="kg"
                className={styles.input}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="95.7"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="at">
                Date &amp; time
              </label>
              <input
                id="at"
                className={styles.input}
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </div>
            <button className={styles.submit} type="submit" disabled={!kg}>
              Save
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}

        <div className={styles.periods} role="group" aria-label="Chart period">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.period} ${p === period ? styles.periodActive : ""}`}
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <div className={styles.chartHolder}>
          <WeightChart entries={visible} />
        </div>
      </div>
    </main>
  );
}
