import assert from "node:assert/strict";
import test from "node:test";
import { chartSelection, dailyCalories } from "../app/lib/chart-data.ts";
import { filterByPeriod } from "../app/lib/period.ts";

test("calories are summed into sorted calendar days without changing the logs", () => {
  const entries = [
    { id: "later", at: "2026-09-13T16:00", kcal: 300 },
    { id: "next", at: "2026-09-14T00:01", kcal: 100 },
    { id: "first", at: "2026-09-13T14:00", kcal: 500 },
    { id: "previous", at: "2026-09-12T23:59", kcal: 200 },
  ];
  const original = structuredClone(entries);
  assert.deepEqual(dailyCalories(entries), [
    { id: "2026-09-12", at: "2026-09-12T00:00:00.000", kcal: 200 },
    { id: "2026-09-13", at: "2026-09-13T00:00:00.000", kcal: 800 },
    { id: "2026-09-14", at: "2026-09-14T00:00:00.000", kcal: 100 },
  ]);
  assert.deepEqual(entries, original);
  assert.deepEqual(dailyCalories([]), []);
});

test("period filtering keeps the entire first day's total", () => {
  const totals = dailyCalories([
    { id: "a", at: "2026-08-14T09:00", kcal: 500 },
    { id: "b", at: "2026-08-14T16:00", kcal: 300 },
    { id: "c", at: "2026-09-13T16:00", kcal: 100 },
  ]);
  assert.equal(filterByPeriod(totals, "1M")[0].kcal, 800);
});

const weights = [12, 13, 14].map((day, i) => ({
  entry: { at: `2026-09-${day}T12:00`, kg: 80 }, x: i * 100,
}));
const calories = [{ entry: { at: "2026-09-13T00:00", kcal: 800 }, x: 50 }];

test("a single calorie total is only shown on its own selected day", () => {
  for (const x of [0, 200]) {
    const selection = chartSelection(weights, calories, x);
    assert.equal(selection.activeCalorie, null);
    assert.equal(selection.anchor, x === 0 ? weights[0] : weights[2]);
  }
  assert.equal(chartSelection(weights, calories, 100).activeCalorie, calories[0]);
  assert.equal(chartSelection(weights, calories, 50).activeWeight, weights[1]);
});

test("selection handles hidden and empty series", () => {
  assert.equal(chartSelection([], calories, 50).anchor, calories[0]);
  assert.equal(chartSelection(weights, [], 100).activeCalorie, null);
  assert.deepEqual(chartSelection([], [], 0), {
    anchor: null, activeWeight: null, activeCalorie: null,
  });
});
