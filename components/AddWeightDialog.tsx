"use client";

import { useRef, type FormEvent } from "react";
import { nowForDateTimeInput } from "@/lib/weight/format";
import styles from "./AddWeightDialog.module.css";

type AddWeightDialogProps = {
  onAdd: (weightKg: number, recordedAt: string) => void;
};

export default function AddWeightDialog({ onAdd }: AddWeightDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  function open() {
    // Reset so a previously typed-then-cancelled value doesn't linger, and
    // so the date/time default is "now" rather than whenever this
    // component first mounted.
    formRef.current?.reset();
    if (dateInputRef.current) dateInputRef.current.value = nowForDateTimeInput();
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const weightKg = Number(form.get("weightKg"));
    const recordedAtLocal = String(form.get("recordedAt"));
    if (!Number.isFinite(weightKg) || weightKg <= 0 || !recordedAtLocal) return;

    onAdd(weightKg, new Date(recordedAtLocal).toISOString());
    e.currentTarget.reset();
    close();
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={open}>
        + Add weight
      </button>

      <dialog ref={dialogRef} className={styles.dialog} onClose={close}>
        <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
          <h2 className={styles.title}>Add weight</h2>

          <label className={styles.field}>
            <span>Weight (kg)</span>
            <input
              name="weightKg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              max="500"
              required
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span>Date &amp; time</span>
            <input
              ref={dateInputRef}
              name="recordedAt"
              type="datetime-local"
              defaultValue={nowForDateTimeInput()}
              required
            />
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={styles.submit}>
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
