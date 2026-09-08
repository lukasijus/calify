"use client";

/* eslint-disable @next/next/no-img-element -- Photos are resized local data URLs. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import WeightChart from "./components/weight-chart";
import { calorieTotal, dailyFoods, localDateTime, parseData, preparePhoto, STORAGE_KEY, type TrackerData } from "./tracker";

export default function Home() {
  const [data, setData] = useState<TrackerData>({ weights: [], foods: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [day, setDay] = useState("");
  const [mode, setMode] = useState<"weight" | "food">("weight");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const load = () => {
      try {
        setData(parseData(localStorage.getItem(STORAGE_KEY)));
        setReady(true);
        setError("");
      } catch {
        setReady(false);
        setError("Your saved entries could not be loaded. Enable browser storage or restore valid saved data, then reload. Existing data has not been overwritten.");
      }
    };
    // Load only after hydration; also refresh when another tab saves an entry.
    queueMicrotask(() => { load(); setDay(localDateTime().slice(0, 10)); });
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) load(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function openForm(nextMode: "weight" | "food") {
    setMode(nextMode);
    setAt(localDateTime());
    setNotice("");
    setError("");
    setFormOpen(true);
    dialog.current?.showModal();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const date = new Date(at);
      if (!Number.isFinite(date.getTime())) throw new Error("Choose a valid date and time.");
      const entry = { id: crypto.randomUUID(), at: date.toISOString() };
      let photo: string | undefined;
      const file = fields.get("photo");
      if (mode === "food" && file instanceof File && file.size > 0) photo = await preparePhoto(file);
      const latest = parseData(localStorage.getItem(STORAGE_KEY));
      if (mode === "weight") {
        const kg = Number(fields.get("kg"));
        if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) throw new Error("Enter a weight between 0.1 and 1,000 kg.");
        latest.weights.push({ ...entry, kg });
      } else {
        const description = String(fields.get("description") ?? "").trim();
        const value = String(fields.get("calories") ?? "").trim();
        const calories = value === "" ? undefined : Number(value);
        if (!description) throw new Error("Add a short description of your food.");
        if (calories !== undefined && (!Number.isFinite(calories) || calories < 0)) throw new Error("Calories must be zero or greater.");
        latest.foods.push({ ...entry, description, calories, photo });
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(latest)); }
      catch { throw new Error("Could not save: browser storage is unavailable or full. Try a smaller photo or allow storage. Your entry is still in this form."); }
      setData(latest);
      if (mode === "food") setDay(localDateTime(date).slice(0, 10));
      setNotice(mode === "weight" ? "Weight saved." : "Food entry saved.");
      dialog.current?.close();
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this entry. Please try again.");
    } finally { setBusy(false); }
  }

  const weights = [...data.weights].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const latest = weights.at(-1);
  const previous = weights.at(-2);
  const change = latest && previous ? latest.kg - previous.kg : null;
  const foods = dailyFoods(data.foods, day);
  const total = calorieTotal(foods);

  return <>
    <header className="site-header">
      <a className="brand" href="#">
        <span className="brand-icon">c</span>calify<span className="brand-dot">.</span>
      </a>
      <span className="header-note">A little progress, every day.</span>
      <span className="local-badge">
        <span /> On this device</span>
    </header>
    <main>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR DAILY CHECK-IN</p>
          <h1>Small steps. Real progress.</h1>
          <p>A space to keep track, find your rhythm, and feel good.</p>
        </div>
        <a className="text-link" href="#food-log">Go to food log <span>↓</span>
        </a>
      </div>
      <p className="status" role="status">{notice || (!ready && !error ? "Loading your journal…" : "")}</p>
      {error && !formOpen && <p className="error" role="alert">{error}</p>}
      <section className="panel weight-panel" aria-labelledby="weight-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE BIGGER PICTURE</p>
            <h2 id="weight-title">Weight journey</h2>
          </div>
          <button disabled={!ready} onClick={() => openForm("weight")}>＋ Add weight</button>
        </div>
        <div className="weight-stats">
          <div>
            <span className="stat-label">Latest weight</span>
            <p className="weight-value">{latest ? latest.kg.toFixed(1) : "—"}<span>kg</span>
            </p>
          </div>
          <div className="trend">
            <span className="stat-label">Since previous entry</span>
            <p>{change === null ? "Your next entry tells the story" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`}</p>{previous && <small>Compared with {new Date(previous.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>}</div>
          <span className="chart-period">All history</span>
        </div>
        <WeightChart entries={weights} />
        <div className="panel-foot">
          <span className="legend-dot" /> Weight in kilograms <span className="foot-note">Progress takes time. Every check-in counts.</span>
        </div>
      </section>
      <section className="food-section" id="food-log" aria-labelledby="food-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ONE MEAL AT A TIME</p>
            <h2 id="food-title">Food journal</h2>
          </div>
          <button disabled={!ready} onClick={() => openForm("food")}>＋ Add food</button>
        </div>
        <div className="food-grid">
          <div className="panel food-feed">
            <div className="feed-heading">
              <label htmlFor="journal-day">Your daily entries</label>
              <input id="journal-day" aria-label="Food journal date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
            </div>
            {!foods.length ? <div className="food-empty">
              <span className="empty-symbol">＋</span>
              <h3>What’s on your plate?</h3>
              <p>A quick note, a photo, or a calorie count.<br />Log your meals in whatever way works for you.</p>
              <button className="secondary" disabled={!ready} onClick={() => openForm("food")}>Log a meal</button>
            </div> : <ul className="food-list">{foods.map((food) => <li key={food.id} className="food-entry">
              <div className="meal-icon" aria-hidden="true">≋</div>
              <div className="food-content">
                <time dateTime={food.at}>{new Date(food.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
                <h3>{food.description}</h3>{food.photo && /* Local data URLs are already resized; no image server is needed. */ <img className="food-photo" src={food.photo} alt={`Photo of ${food.description}`} width="160" height="112" />}</div>
              <span className="calorie-pill">{food.calories === undefined ? "No calories" : `${food.calories.toLocaleString()} kcal`}</span>
            </li>)}</ul>}
          </div>
          <aside className="daily-summary">
            <span className="summary-icon" aria-hidden="true">◔</span>
            <p className="eyebrow">DAILY CALORIES</p>
            <p className="calorie-value">{total === null ? "—" : total.toLocaleString()}<span>kcal logged</span>
            </p>
            <p>{foods.length} {foods.length === 1 ? "entry" : "entries"} for this day</p>
            <div className="summary-note">{total === null ? "Add calories to a meal to see your daily total here." : "Your total includes only meals with a calorie value. Every little note helps."}</div>
          </aside>
        </div>
      </section>
      <footer>Made for your everyday.<span>Entries and photos stay in this browser. No account or sync. Clearing site data removes them.</span>
      </footer>
    </main>
    <dialog ref={dialog} aria-labelledby="entry-title" onClose={() => setFormOpen(false)} onCancel={(event) => { if (busy) event.preventDefault(); else setError(""); }}>
      <form key={mode} onSubmit={save}>
        <div className="section-heading">
          <h2 id="entry-title">{mode === "weight" ? "Add a weight" : "Log your food"}</h2>
          <button className="close-button" type="button" aria-label="Close form" disabled={busy} onClick={() => { dialog.current?.close(); setError(""); }}>×</button>
        </div>
        <p className="form-intro">A small check-in for your everyday progress.</p>
        <fieldset disabled={busy}>
          {mode === "weight" ? <label>Weight (kg)<input name="kg" type="number" min="0.1" max="1000" step="0.1" placeholder="e.g. 75.5" required autoFocus />
          </label> : <>
            <label>What did you eat?<textarea name="description" placeholder="e.g. Greek yogurt with berries" maxLength={500} required autoFocus rows={3} />
            </label>
            <label>Calories <span className="optional">optional</span>
              <input name="calories" type="number" min="0" max="100000" step="1" placeholder="kcal" />
            </label>
            <label>Photo <span className="optional">optional</span>
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
              <small>JPG, PNG, or WebP · up to 10 MB. Photos are resized for storage.</small>
            </label>
          </>}
          <label>Date and time<input name="at" type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} required />
          </label>
        </fieldset>{error && <p className="error" role="alert">{error}</p>}<button className="save-button" type="submit" disabled={busy}>{busy ? "Saving…" : mode === "weight" ? "Save weight" : "Save food entry"}</button>
      </form>
    </dialog>
  </>;
}
