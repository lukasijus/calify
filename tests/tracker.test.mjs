import assert from "node:assert/strict";
import test from "node:test";
import { calorieTotal, dailyFoods, localDateTime, preparePhoto } from "../app/tracker.ts";

process.env.TZ = "Europe/Helsinki";

test("date/time defaults use local calendar time, including winter and summer offsets", () => {
  assert.equal(localDateTime(new Date("2026-01-01T23:30:00Z")), "2026-01-02T01:30");
  assert.equal(localDateTime(new Date("2026-07-01T23:30:00Z")), "2026-07-02T02:30");
});

test("daily feed groups by local day and sorts newest first without changing stored order", () => {
  const foods = [
    { id: "1", date: "2026-09-08T21:30:00Z", description: "Late snack" },
    { id: "2", date: "2026-09-09T09:00:00Z", description: "Lunch", calories: 400 },
    { id: "3", date: "2026-09-08T20:59:00Z", description: "Previous day" },
  ];
  assert.deepEqual(dailyFoods(foods, "2026-09-09").map((food) => food.id), ["2", "1"]);
  assert.deepEqual(foods.map((food) => food.id), ["1", "2", "3"]);
  assert.deepEqual(dailyFoods(foods, "2026-09-10"), []);
});

test("calorie totals distinguish untracked calories from explicit zero", () => {
  assert.equal(calorieTotal([]), null);
  assert.equal(calorieTotal([{ description: "Untracked meal" }]), null);
  assert.equal(calorieTotal([{ calories: 0 }]), 0);
  assert.equal(calorieTotal([{ calories: 200 }, {}, { calories: 120.5 }]), 320.5);
});

test("photo validation rejects unsupported input and oversized files before decoding", async () => {
  await assert.rejects(preparePhoto(new File(["text"], "note.txt", { type: "text/plain" })), /image smaller than 15 MB/);
  await assert.rejects(preparePhoto(new File([new Uint8Array(15 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" })), /image smaller than 15 MB/);
});
