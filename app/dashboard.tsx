"use client";

import { useEffect, useState, type FormEvent } from "react";
import WeightChart from "./weight-chart";
import { calorieTotal, dailyFoods, localDateTime, preparePhoto, readEntries, writeEntry, type Entries } from "./tracker";

function FoodPhoto({ photo, description }: { photo: Blob; description: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(photo);
    // Object URLs belong to this mounted photo and must be released on unmount.
    setUrl(next); // eslint-disable-line react-hooks/set-state-in-effect
    return () => URL.revokeObjectURL(next);
  }, [photo]);
  // User-provided local blobs do not benefit from the Next.js image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="food-photo" src={url} alt={description} /> : null;
}

export default function Dashboard() {
  const [entries, setEntries] = useState<Entries>({ weights: [], foods: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState("");
  const [weightDate, setWeightDate] = useState("");
  const [foodDate, setFoodDate] = useState("");

  useEffect(() => {
    let active = true;
    readEntries().then((saved) => {
      if (!active) return;
      setEntries(saved);
      setDay(localDateTime().slice(0, 10));
      setWeightDate(localDateTime());
      setFoodDate(localDateTime());
      setReady(true);
    }).catch(() => {
      if (active) setError("Your saved entries could not be loaded. Enable browser storage, then reload to try again.");
    });
    return () => { active = false; };
  }, []);

  const weights = [...entries.weights].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const latest = weights.at(-1);
  const recent = latest ? weights.filter((entry) => Date.parse(entry.date) >= Date.parse(latest.date) - 7 * 86400_000) : [];
  const change = recent.length > 1 ? recent[recent.length - 1].kg - recent[0].kg : null;
  const foods = dailyFoods(entries.foods, day);
  const total = calorieTotal(foods);

  async function addEntry(event: FormEvent<HTMLFormElement>, kind: "weights" | "foods") {
    event.preventDefault();
    if (!ready || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const date = new Date(String(data.get("date")));
      if (!Number.isFinite(date.getTime())) throw new Error("Please enter a valid date and time.");
      const base = { id: crypto.randomUUID(), date: date.toISOString() };
      if (kind === "weights") {
        const kg = Number(data.get("kg"));
        if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) throw new Error("Enter a weight greater than 0 and no more than 1,000 kg.");
        const entry = { ...base, kg };
        await writeEntry("weights", entry);
        setEntries((current) => ({ ...current, weights: [...current.weights, entry] }));
        setWeightDate(localDateTime());
        setNotice("Weight saved.");
      } else {
        const description = String(data.get("description") ?? "").trim();
        if (!description) throw new Error("Add a short description of your food.");
        const rawCalories = String(data.get("calories") ?? "").trim();
        const calories = rawCalories === "" ? undefined : Number(rawCalories);
        if (calories !== undefined && (!Number.isFinite(calories) || calories < 0 || calories > 100000)) throw new Error("Enter calories between 0 and 100,000, or leave them blank.");
        const file = data.get("photo");
        const photo = file instanceof File && file.size > 0 ? await preparePhoto(file) : undefined;
        const entry = { ...base, description, calories, photo };
        await writeEntry("foods", entry);
        setEntries((current) => ({ ...current, foods: [...current.foods, entry] }));
        setDay(localDateTime(date).slice(0, 10));
        setFoodDate(localDateTime());
        setNotice("Food saved.");
      }
      form.reset();
    } catch (failure) {
      setError(failure instanceof DOMException ? "Could not save this entry. Browser storage may be full or unavailable. Your entry has not been saved; try again." : failure instanceof Error ? failure.message : "Could not save this entry. Please try again.");
    } finally { setBusy(false); }
  }

  async function removeEntry(kind: "weights" | "foods", id: string) {
    if (busy || !window.confirm("Delete this entry? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await writeEntry(kind, id);
      setEntries((current) => ({ ...current, [kind]: current[kind].filter((entry) => entry.id !== id) }));
      setNotice("Entry deleted.");
    } catch { setError("This entry could not be deleted. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="#dashboard"><span className="brand-mark" aria-hidden="true">c</span>calify<span className="brand-dot">.</span></a><nav aria-label="Dashboard sections"><a href="#weight">Weight</a><a href="#food">Food log</a></nav><span className="local-badge"><span aria-hidden="true">●</span> Your daily space</span></header>
    <main id="dashboard">
      <div className="page-heading"><div><p className="eyebrow">A LITTLE EVERY DAY</p><h1>Small steps. Real progress.</h1><p>A simple space to track your weight and what fuels you.</p></div><span className="heading-decoration" aria-hidden="true">↗</span></div>
      <div className="feedback" aria-live="polite">{notice}</div>
      {error && <p className="error" role="alert">{error}</p>}
      {!ready && !error && <p role="status">Loading your journal…</p>}
      <section id="weight" className="panel weight-panel" aria-labelledby="weight-title">
        <div className="section-heading"><div><p className="eyebrow">THE BIG PICTURE</p><h2 id="weight-title">Your weight journey</h2></div><span className="pill">All history</span></div>
        <div className="weight-layout"><div className="weight-main"><div className="weight-stats"><div><span className="stat-label">Latest weight</span><p className="stat-value">{latest ? latest.kg.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}<span> kg</span></p><span className="muted">{latest ? new Date(latest.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Your starting point is yours"}</span></div><div className="trend"><span className="stat-label">Recent change</span><p className="trend-value">{change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(2)} kg`}</p><span className="muted">7 days ending at latest entry</span></div></div><WeightChart entries={weights} /></div>
          <form className="entry-form weight-form" onSubmit={(event) => addEntry(event, "weights")}><h3>Check in with yourself</h3><p>One entry at a time.</p><fieldset disabled={!ready || busy}><label htmlFor="kg">Weight <span>kg</span></label><input id="kg" name="kg" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" placeholder="e.g. 74.5" required /><label htmlFor="weight-date">Date & time</label><input id="weight-date" name="date" type="datetime-local" value={weightDate} onChange={(event) => setWeightDate(event.target.value)} required /><button className="primary" type="submit">＋ Save weight</button></fieldset></form>
        </div>
        {weights.length > 0 && <details className="history"><summary>View weight entries <span>{weights.length}</span></summary><ul>{[...weights].reverse().map((entry) => <li key={entry.id}><time dateTime={entry.date}>{new Date(entry.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time><strong>{entry.kg} kg</strong><button className="delete" disabled={busy} onClick={() => removeEntry("weights", entry.id)} aria-label={`Delete weight ${entry.kg} kg on ${new Date(entry.date).toLocaleString()}`}>Delete</button></li>)}</ul></details>}
      </section>
      <section id="food" className="food-section" aria-labelledby="food-title"><div className="section-heading"><div><p className="eyebrow">MAKE ROOM FOR THE EVERYDAY</p><h2 id="food-title">Your food journal</h2></div><div className="day-picker"><label htmlFor="journal-day">Journal date</label><input id="journal-day" type="date" value={day} disabled={!ready} onChange={(event) => setDay(event.target.value)} required /></div></div>
        <div className="food-layout"><div className="panel food-feed"><div className="feed-heading"><div><h3>On your plate</h3><p>{foods.length} {foods.length === 1 ? "entry" : "entries"} for this day</p></div><div className="calorie-total"><strong>{total === null ? "—" : total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong><span> kcal logged</span></div></div>
          {foods.length === 0 ? <div className="food-empty"><span className="empty-symbol" aria-hidden="true">＋</span><h3>A fresh page for your day</h3><p>Log a meal, a snack, or a little something.<br />Calories and photos are always optional.</p></div> : <ul className="food-list">{foods.map((food) => <li key={food.id} className="food-card">{food.photo && <FoodPhoto photo={food.photo} description={food.description} />}<div className="food-copy"><time dateTime={food.date}>{new Date(food.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><p>{food.description}</p><span className="muted">{food.calories === undefined ? "Calories not added" : `${food.calories.toLocaleString()} kcal`}</span></div><button className="delete" disabled={busy} onClick={() => removeEntry("foods", food.id)} aria-label={`Delete ${food.description}`}>Delete</button></li>)}</ul>}
          {total !== null && <p className="total-note">Total includes entries with calories provided.</p>}
        </div><form className="panel entry-form food-form" onSubmit={(event) => addEntry(event, "foods")}><h3>Add a little nourishment</h3><p>Keep it simple. Make it yours.</p><fieldset disabled={!ready || busy}><label htmlFor="description">What did you have?</label><textarea id="description" name="description" placeholder="e.g. Greek yogurt, berries & a little honey" maxLength={1000} rows={3} required /><div className="form-pair"><div><label htmlFor="calories">Calories <span>optional</span></label><input id="calories" name="calories" type="number" inputMode="decimal" min="0" max="100000" step="0.1" placeholder="kcal" /></div><div><label htmlFor="food-date">Date & time</label><input id="food-date" name="date" type="datetime-local" value={foodDate} onChange={(event) => setFoodDate(event.target.value)} required /></div></div><label htmlFor="photo">A photo <span>optional</span></label><input id="photo" name="photo" type="file" accept="image/*" aria-describedby="photo-help" /><p id="photo-help" className="input-hint">Up to 15 MB. Photos are resized to save space.</p><button className="primary" type="submit">＋ Save food</button></fieldset></form></div>
      </section>
      <footer><span className="footer-brand">calify.</span><p>Saved on this browser, on this device. No account needed.<br />Clearing browser data removes your journal.</p><span className="footer-note">Progress, at your pace.</span></footer>
    </main>
  </div>;
}
