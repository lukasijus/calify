import assert from "node:assert/strict";
import test from "node:test";
import { chartHover } from "../app/lib/chart-hover.ts";

const point = (at, x) => ({ entry: { at }, x });

test("a single calorie log stays on its own day while scrubbing weights", () => {
  const weights = [1, 2, 3].map((day) => point(`2026-09-0${day}T08:00`, day * 100));
  const calorie = point("2026-09-02T12:00", 210);
  for (const weight of weights) {
    const hover = chartHover(weights, [calorie], weight.x);
    assert.equal(hover.anchor, weight);
    assert.equal(hover.activeCalorie, weight === weights[1] ? calorie : null);
  }
  assert.equal(chartHover(weights, [calorie], 210).activeCalorie, calorie);
});

test("selects a calorie on the tooltip day even if another day's log is closer", () => {
  const weight = point("2026-09-02T23:00", 230);
  const sameDay = point("2026-09-02T08:00", 80);
  const nextDay = point("2026-09-03T00:00", 240);
  assert.equal(chartHover([weight], [sameDay, nextDay], 230).activeCalorie, sameDay);
});

test("matches the full date across month and year boundaries", () => {
  const weight = point("2026-09-02T08:00", 100);
  for (const at of ["2026-08-02T08:00", "2025-09-02T08:00"]) {
    assert.equal(chartHover([weight], [point(at, 200)], 100).activeCalorie, null);
  }
});

test("calorie-only charts select the nearest log; empty and cleared hovers stay empty", () => {
  const calories = [point("2026-09-02T08:00", 100), point("2026-09-02T12:00", 200)];
  assert.equal(chartHover([], calories, 190).activeCalorie, calories[1]);
  assert.deepEqual(chartHover([], [], 100), { activeWeight: null, activeCalorie: null, anchor: null });
  assert.deepEqual(chartHover([], calories, null), { activeWeight: null, activeCalorie: null, anchor: null });
});
