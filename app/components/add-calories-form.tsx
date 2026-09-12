"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, validCalorieInput } from "../lib/calories";
import { toDateTimeLocalValue, toLocalIso } from "../lib/weight";

export function AddCaloriesForm({ onAdd, onClose }: {
  onAdd: (kcal: number, at: string, image: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [kcal, setKcal] = useState("");
  const [at, setAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const file = fileInput.current?.files?.[0];
      let image: string | null = null;
      if (file) {
        if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
          throw new Error("Choose a JPEG, PNG or WebP image up to 2 MB.");
        }
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Couldn't read that image. Choose it again."));
          reader.readAsDataURL(file);
        });
      }
      const input = { kcal: Number(kcal), at, image };
      if (!validCalorieInput(input)) throw new Error("Enter whole calories (1–100000), a valid date, and a supported image.");
      await onAdd(input.kcal, toLocalIso(new Date(at)), image);
      onClose();
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
          <label className="wc-field"><span>Calories (kcal)</span>
            <input autoFocus required type="number" min="1" max="100000" step="1" inputMode="numeric"
              value={kcal} onChange={(event) => setKcal(event.target.value)} />
          </label>
          <label className="wc-field"><span>Date &amp; time</span>
            <input required type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} />
          </label>
          <label className="wc-field"><span>Image (optional, JPEG / PNG / WebP, up to 2 MB)</span>
            <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} />
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
