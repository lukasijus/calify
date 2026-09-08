import assert from "node:assert/strict";
import { test } from "node:test";
import { calorieTotal, foodsForDay, localDate, localDateTime, orderedWeights } from "../app/tracker.ts";

const weight = (id, at, kg) => ({ id, kind: "weight", at, kg });
const food = (id, at, calories) => ({ id, kind: "food", at, description: "Lunch", calories });

test("weight history orders backdated entries and preserves duplicate timestamps", () => {
  const entries = [weight("latest", "2026-09-08T12:00:00.000Z", 72), food("lunch", "2026-09-08T11:00:00.000Z", 300), weight("first", "2026-09-01T12:00:00.000Z", 74), weight("same-time", "2026-09-08T12:00:00.000Z", 72.1)];
  const original = [...entries];
  assert.deepEqual(orderedWeights(entries).map(({ id }) => id), ["first", "latest", "same-time"]);
  assert.deepEqual(entries, original);
  assert.deepEqual(orderedWeights([]), []);
});

test("daily feed uses local dates at midnight and orders newest first", () => {
  const early = new Date(2026, 8, 8, 0, 1);
  const late = new Date(2026, 8, 8, 23, 59);
  const nextDay = new Date(2026, 8, 9, 0, 0);
  const entries = [food("early", early.toISOString(), 100), food("next", nextDay.toISOString(), 500), food("late", late.toISOString()), weight("weight", early.toISOString(), 70)];
  assert.deepEqual(foodsForDay(entries, "2026-09-08").map(({ id }) => id), ["late", "early"]);
  assert.equal(calorieTotal(foodsForDay(entries, "2026-09-08")), 100);
  assert.deepEqual(foodsForDay(entries, "2026-09-10"), []);
});

test("calorie totals distinguish missing calories from explicit zero", () => {
  assert.equal(calorieTotal([]), null);
  assert.equal(calorieTotal([food("unknown", "")] ), null);
  assert.equal(calorieTotal([food("zero", "", 0), food("unknown", "")]), 0);
  assert.equal(calorieTotal([food("one", "", 120.5), food("two", "", 350), food("unknown", "")]), 470.5);
});

test("form defaults use local time rather than UTC and pad single digits", () => {
  const date = new Date(2026, 0, 2, 3, 4);
  assert.equal(localDate(date), "2026-01-02");
  assert.equal(localDateTime(date), "2026-01-02T03:04");
});
