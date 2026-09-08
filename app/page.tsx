"use client";

import { useMemo, useState } from "react";
import AddWeightDialog from "@/components/AddWeightDialog";
import PeriodSelector from "@/components/PeriodSelector";
import WeightChart from "@/components/WeightChart";
import { useWeightEntries } from "@/hooks/useWeightEntries";
import { formatWeight } from "@/lib/weight/format";
import { filterByPeriod } from "@/lib/weight/period";
import type { WeightPeriod } from "@/lib/weight/types";
import styles from "./page.module.css";

export default function Home() {
  const { entries, addEntry, isLoading } = useWeightEntries();
  const [period, setPeriod] = useState<WeightPeriod>("ALL");

  const sorted = entries ?? [];
  const visible = useMemo(() => filterByPeriod(sorted, period), [sorted, period]);
  const latest = sorted[sorted.length - 1];
  const change = useMemo(() => {
    if (visible.length < 2) return null;
    return visible[visible.length - 1].weightKg - visible[0].weightKg;
  }, [visible]);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.stat}>
            <span className={styles.label}>Weight</span>
            <span className={styles.value}>{latest ? formatWeight(latest.weightKg) : "—"}</span>
            {change !== null && (
              <span className={styles.change}>
                {change > 0 ? "+" : ""}
                {change.toFixed(1)} kg this period
              </span>
            )}
          </div>

          <div className={styles.controls}>
            <PeriodSelector value={period} onChange={setPeriod} />
            <AddWeightDialog onAdd={addEntry} />
          </div>
        </div>

        {isLoading ? (
          <div className={styles.skeleton} aria-hidden />
        ) : (
          <WeightChart entries={visible} />
        )}
      </div>
    </main>
  );
}
