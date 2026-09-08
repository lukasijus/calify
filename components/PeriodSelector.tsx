"use client";

import { WEIGHT_PERIODS, type WeightPeriod } from "@/lib/weight/types";
import styles from "./PeriodSelector.module.css";

type PeriodSelectorProps = {
  value: WeightPeriod;
  onChange: (period: WeightPeriod) => void;
};

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className={styles.group} role="group" aria-label="Chart period">
      {WEIGHT_PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          className={period.value === value ? styles.active : styles.option}
          onClick={() => onChange(period.value)}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
