"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import WeightChart from "./weight-chart";
import { calorieTotal, foodsForDay, localDate, localDateTime, orderedWeights, preparePhoto, readEntries, removeEntry, saveEntry, type Entry } from "./tracker";

type EntryKind = Entry["kind"];
const dateLabel = (at: string) => new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

function EntryDialog({ kind, onClose, onSaved }: { kind: EntryKind; onClose: () => void; onSaved: (entry: Entry) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [at, setAt] = useState(() => localDateTime());
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const timestamp = new Date(at);
      if (!Number.isFinite(timestamp.getTime())) throw new Error("Choose a valid date and time.");
      const base = { id: crypto.randomUUID(), at: timestamp.toISOString() };
      let entry: Entry;
      if (kind === "weight") {
        const kg = Number(values.get("kg"));
        if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) throw new Error("Enter a weight above 0 and up to 1,000 kg.");
        entry = { ...base, kind, kg };
      } else {
        const description = String(values.get("description") ?? "").trim();
        if (!description) throw new Error("Add a short description of your food.");
        const rawCalories = String(values.get("calories") ?? "").trim();
        const calories = rawCalories ? Number(rawCalories) : undefined;
        if (calories !== undefined && (!Number.isFinite(calories) || calories < 0 || calories > 100000)) throw new Error("Calories must be between 0 and 100,000.");
        const file = values.get("photo");
        const photo = file instanceof File && file.size ? await preparePhoto(file) : undefined;
        entry = { ...base, kind, description, calories, photo };
      }
      try { await saveEntry(entry); }
      catch { throw new Error("Could not save to this browser. Storage may be full or unavailable. Your form is still here; try a smaller photo or free some space."); }
      onSaved(entry);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this entry. Please try again.");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="entry-dialog" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }} aria-labelledby="entry-title">
      <div className="section-heading"><div><p className="eyebrow">A little check-in</p><h2 id="entry-title">{kind === "weight" ? "Log your weight" : "Add a food entry"}</h2></div><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {kind === "weight" ? <label>Weight <span>kg</span><input autoFocus name="kg" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" placeholder="e.g. 72.5" required /></label> : <>
            <label>What did you eat?<textarea autoFocus name="description" maxLength={1000} placeholder="e.g. Greek yogurt, berries & granola" rows={3} required /></label>
            <label>Calories <span>optional · kcal</span><input name="calories" type="number" inputMode="decimal" min="0" max="100000" step="0.1" placeholder="e.g. 320" /></label>
            <label>Photo <span>optional</span><input className="file-input" name="photo" type="file" accept="image/*" /><small>Up to 10 MB. Photos are resized and stored in this browser.</small></label>
          </>}
          <label>Date & time<input name="at" type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} required /></label>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save entry"}</button></div>
      </form>
    </dialog>
  );
}

export default function Dashboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [day, setDay] = useState("");
  const [kind, setKind] = useState<EntryKind | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readEntries().then((saved) => {
      if (active) { setEntries(saved); setDay(localDate()); setLoaded(true); }
    }).catch(() => { if (active) setError("Your entries could not be loaded. Enable browser storage and reload to try again."); });
    return () => { active = false; };
  }, []);

  const weights = orderedWeights(entries);
  const latest = weights.at(-1);
  const previous = weights.at(-2);
  const change = latest && previous ? latest.kg - previous.kg : null;
  const foods = foodsForDay(entries, day);
  const total = calorieTotal(foods);
  const unknownCalories = foods.filter((food) => food.calories === undefined).length;

  async function deleteEntry(entry: Entry) {
    if (!window.confirm(`Delete this ${entry.kind} entry? This cannot be undone.`)) return;
    setDeleting(entry.id);
    setError("");
    try {
      await removeEntry(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setNotice("Entry deleted.");
    } catch { setError("Could not delete this entry. Please try again."); }
    finally { setDeleting(null); }
  }

  return (
    <div className="app-shell">
      <header className="site-header"><Link className="brand" href="/" aria-label="Calify home"><span className="brand-mark" aria-hidden="true">c<span /></span>calify<span className="brand-dot">.</span></Link><span className="header-note"><span className="status-dot" /> Small steps. Lasting habits.</span></header>
      <main>
        <div className="page-heading"><div><p className="eyebrow">Your daily check-in</p><h1>A little progress, every day.</h1><p className="subtitle">Make space for healthier habits. One entry at a time.</p></div><span className="local-badge">◎ &nbsp; Stored on this device</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="sr-only" role="status">{notice || (!loaded && !error ? "Loading your entries…" : "")}</p>
        <section className="panel weight-panel" aria-labelledby="weight-title">
          <div className="section-heading"><div><p className="eyebrow">The bigger picture</p><h2 id="weight-title">Weight journey</h2></div><button className="primary" disabled={!loaded} onClick={() => setKind("weight")}><span aria-hidden="true">＋</span> Log weight</button></div>
          <div className="weight-summary"><div><span className="metric-label">Latest weight</span><div className="weight-value">{latest ? latest.kg.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}<span>kg</span></div><p className="metric-caption">{latest ? dateLabel(latest.at) : "Your starting point is a fresh start"}</p></div><div className="trend-block"><span className="metric-label">Since previous entry</span><strong className="trend-value">{change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)} kg`}</strong><p className="metric-caption">{previous ? `Compared with ${dateLabel(previous.at)}` : "A trend begins with two entries"}</p></div></div>
          {!loaded ? <div className="chart-empty"><p>{error ? "Your history is currently unavailable." : "Loading your journey…"}</p></div> : <WeightChart entries={weights} />}
          <div className="chart-footer"><span><i className="legend-dot" /> Weight · kg</span><span>All time · {weights.length} {weights.length === 1 ? "entry" : "entries"}</span></div>
          {!!weights.length && <details className="weight-history"><summary>View weight history</summary><ul>{[...weights].reverse().map((entry) => <li key={entry.id}><time dateTime={entry.at}>{dateLabel(entry.at)}</time><strong>{entry.kg} kg</strong><button className="text-button" disabled={deleting !== null} aria-label={`Delete weight ${entry.kg} kg on ${dateLabel(entry.at)}`} onClick={() => deleteEntry(entry)}>Delete</button></li>)}</ul></details>}
        </section>
        <section className="panel food-panel" aria-labelledby="food-title">
          <div className="section-heading"><div><p className="eyebrow">Nourish your day</p><h2 id="food-title">Food journal</h2></div><button className="secondary" disabled={!loaded} onClick={() => setKind("food")}><span aria-hidden="true">＋</span> Add food</button></div>
          <div className="food-toolbar"><label className="day-picker">Journal date<input aria-label="Journal date" type="date" value={day} disabled={!loaded} onChange={(event) => { if (event.target.value) setDay(event.target.value); }} /></label><div className="calorie-total"><strong>{total === null ? "—" : total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong><span>kcal logged{unknownCalories > 0 && <small>{unknownCalories} {unknownCalories === 1 ? "entry without" : "entries without"} calories</small>}</span></div></div>
          {!foods.length ? <div className="food-empty"><span className="empty-symbol" aria-hidden="true">＋</span><div><h3>{loaded ? "A fresh page for your day" : "Loading your journal…"}</h3><p>{loaded ? "A quick note, a photo, or a calorie count. Log what works for you." : "Your food entries will appear here."}</p></div></div> : <ul className="food-feed">{foods.map((food) => <li className="food-card" key={food.id}>
            <div className="food-photo">{food.photo ? <>
              {/* User photos are already resized locally; no server image optimization is needed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={food.photo} alt={`Photo of ${food.description}`} width={88} height={88} />
            </> : <span aria-hidden="true">◒</span>}</div>
            <div className="food-detail"><time dateTime={food.at}>{new Date(food.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><h3>{food.description}</h3><span className="food-calories">{food.calories === undefined ? "No calories added" : `${food.calories.toLocaleString()} kcal`}</span></div>
            <button className="text-button" disabled={deleting !== null} aria-label={`Delete food: ${food.description}`} onClick={() => deleteEntry(food)}>Delete</button>
          </li>)}</ul>}
        </section>
        <footer className="page-footer"><span className="footer-mark" aria-hidden="true">✳</span><p>Your pace. Your progress.<small>Entries and photos stay in this browser. They don’t sync across devices and are removed if you clear site data.</small></p></footer>
      </main>
      {kind && <EntryDialog kind={kind} onClose={() => setKind(null)} onSaved={(entry) => { setEntries((current) => [...current, entry]); if (entry.kind === "food") setDay(localDate(new Date(entry.at))); setNotice(`${entry.kind === "food" ? "Food" : "Weight"} entry saved.`); }} />}
    </div>
  );
}
