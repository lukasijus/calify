"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { imageError, IMAGE_TYPES, type CalorieEntry } from "../lib/calorie";
import { toDateTimeLocalValue } from "../lib/weight";

export const CALORIES_API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/calories`;

export function AddCaloriesForm({ onAdd, onClose }: {
  onAdd: (entry: CalorieEntry) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const image = data.get("image");
    if (image instanceof File && image.name) {
      const message = imageError(image);
      if (message) { setError(message); return; }
    } else {
      data.delete("image");
    }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(CALORIES_API, { method: "POST", body: data });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? (response.status === 413
          ? "Upload too large. Choose a smaller image."
          : "Couldn't save calories. Try again."));
      }
      const { entry } = await response.json() as { entry: CalorieEntry };
      onAdd(entry);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save calories. Try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="wc-modal" aria-labelledby="calorie-title"
      onCancel={(event) => { event.preventDefault(); if (!pending.current) onClose(); }}>
      <h2 id="calorie-title">Add calories</h2>
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving} className="wc-calorie-fields">
          <label className="wc-field"><span>Calories (kcal)</span>
            <input name="kcal" type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" required autoFocus />
          </label>
          <label className="wc-field"><span>Date &amp; time</span>
            <input name="at" type="datetime-local" required defaultValue={toDateTimeLocalValue(new Date())} />
          </label>
          <label className="wc-field"><span>Image (optional, JPEG / PNG / WebP, up to 8 MB)</span>
            <input name="image" type="file" accept={IMAGE_TYPES.join(",")} onChange={(event) => {
              const file = event.target.files?.[0];
              setError(file ? imageError(file) : null);
            }} />
          </label>
        </fieldset>
        {error && <p className="wc-form-error" role="alert">{error}</p>}
        <div className="wc-form-actions">
          <button type="button" className="wc-btn wc-btn-ghost" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" className="wc-btn wc-btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </dialog>
  );
}
