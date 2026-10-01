"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ALLOWED_CALORIE_IMAGE_TYPES, MAX_CALORIE_IMAGE_BYTES } from "../lib/calorie";
import { toDateTimeLocalValue } from "../lib/date";

type AddCalorieFormProps = {
  onAdd: (kcal: number, at: Date, images: File[]) => void;
  onClose: () => void;
};

const MAX_IMAGE_MB = MAX_CALORIE_IMAGE_BYTES / (1024 * 1024);

export function AddCalorieForm({ onAdd, onClose }: AddCalorieFormProps) {
  const [kcal, setKcal] = useState("");
  const [at, setAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const kcalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    kcalInputRef.current?.focus();
  }, []);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    for (const file of files) {
      if (!ALLOWED_CALORIE_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_CALORIE_IMAGE_TYPES)[number])) {
        setError(`${file.name}: image must be JPEG, PNG, or WebP.`);
        event.target.value = "";
        setImages([]);
        return;
      }
      if (file.size > MAX_CALORIE_IMAGE_BYTES) {
        setError(`${file.name}: image must be ${MAX_IMAGE_MB} MB or smaller.`);
        event.target.value = "";
        setImages([]);
        return;
      }
    }
    setError(null);
    setImages(files);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number.parseFloat(kcal.replace(",", ".").trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 20_000) {
      setError("Enter calories in kcal");
      return;
    }
    const date = at ? new Date(at) : new Date();
    if (Number.isNaN(date.getTime())) {
      setError("Enter a valid date");
      return;
    }
    onAdd(parsed, date, images);
  };

  return (
    <form className="wc-form" onSubmit={handleSubmit}>
      <div className="wc-form-fields">
        <label className="wc-field">
          <span>Calories (kcal)</span>
          <input
            ref={kcalInputRef}
            // `type="text"` (not `number`) so mobile keyboards that emit a
            // locale decimal separator like "," aren't silently swallowed.
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder="650"
            value={kcal}
            onChange={(event) => {
              const next = event.target.value
                .replace(/[^0-9.,]/g, "")
                .replace(/([.,])(?=.*[.,])/g, "");
              setKcal(next);
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
        <label className="wc-field wc-field-wide">
          <span>Images (optional, JPEG / PNG / WebP, up to {MAX_IMAGE_MB} MB each)</span>
          <input type="file" multiple accept={ALLOWED_CALORIE_IMAGE_TYPES.join(",")} onChange={handleImageChange} />
        </label>
      </div>
      {error && (
        <p className="wc-form-error" role="alert">
          {error}
        </p>
      )}
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
