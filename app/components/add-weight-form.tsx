"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toDateTimeLocalValue } from "../lib/weight";

type AddWeightFormProps = {
  onAdd: (kg: number, at: Date) => void;
  onClose: () => void;
};

export function AddWeightForm({ onAdd, onClose }: AddWeightFormProps) {
  const [kg, setKg] = useState("");
  const [at, setAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const kgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    kgInputRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number.parseFloat(kg.replace(",", ".").trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 700) {
      setError("Enter a weight in kg");
      return;
    }
    const date = at ? new Date(at) : new Date();
    if (Number.isNaN(date.getTime())) {
      setError("Enter a valid date");
      return;
    }
    onAdd(parsed, date);
  };

  return (
    <form className="wc-form" onSubmit={handleSubmit}>
      <div className="wc-form-fields">
        <label className="wc-field">
          <span>Weight (kg)</span>
          <input
            ref={kgInputRef}
            // `type="text"` (not `number`) so mobile keyboards that emit a
            // locale decimal separator like "," aren't silently swallowed —
            // "95,6" must survive to `handleSubmit`, which normalizes it.
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder="95.7"
            value={kg}
            onChange={(event) => {
              const next = event.target.value
                .replace(/[^0-9.,]/g, "")
                .replace(/([.,])(?=.*[.,])/g, "");
              setKg(next);
              setError(null);
            }}
          />
        </label>
        <label className="wc-field">
          <span>Date &amp; time</span>
          <input
            type="datetime-local"
            value={at}
            onChange={(event) => setAt(event.target.value)}
          />
        </label>
      </div>
      {error && <p className="wc-form-error">{error}</p>}
      <div className="wc-form-actions">
        <button type="button" className="wc-btn wc-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="wc-btn wc-btn-primary">
          Save
        </button>
      </div>
    </form>
  );
}
