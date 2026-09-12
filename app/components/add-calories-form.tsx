"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { IMAGE_ACCEPT, imageSizeError, type CalorieEntry } from "../lib/calorie";
import { toDateTimeLocalValue } from "../lib/weight";

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/calories`;

export function AddCaloriesForm({ onAdd, onClose }: {
  onAdd: (entry: CalorieEntry) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("image");
    if (file instanceof File && !file.name && file.size === 0) form.delete("image");
    else if (file instanceof File) {
      const problem = imageSizeError(file.size);
      if (problem) { setError(problem); return; }
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(API, { method: "POST", body: form });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? (response.status === 413
          ? "The upload is too large. Choose a smaller image."
          : "Couldn't save calories. Try again."));
      }
      const { entry } = await response.json() as { entry: CalorieEntry };
      onAdd(entry);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save calories. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="wc-modal" aria-labelledby="calories-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <form onSubmit={submit}>
        <h2 id="calories-title">Add calories</h2>
        <fieldset disabled={saving} className="wc-calorie-fields">
          <label className="wc-field">
            <span>Calories (kcal)</span>
            <input name="kcal" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01" required autoFocus />
          </label>
          <label className="wc-field">
            <span>Date &amp; time</span>
            <input name="at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required />
          </label>
          <label className="wc-field">
            <span>Image (optional, JPEG / PNG / WebP, up to 2 MB)</span>
            <input name="image" type="file" accept={IMAGE_ACCEPT} onChange={(e) => {
              const file = e.target.files?.[0];
              setError(file ? imageSizeError(file.size) : null);
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
