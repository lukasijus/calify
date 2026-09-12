import assert from "node:assert/strict";
import test from "node:test";
import { dailyCalories, MAX_IMAGE_BYTES, validCalorieInput, validImage } from "../app/lib/calories.ts";
import { filterByPeriod } from "../app/lib/weight.ts";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
const input = { kcal: 500, at: "2026-09-12T12:30", image: null };

test("accepts calories with and without an optional raster image", () => {
  assert.equal(validCalorieInput(input), true);
  assert.equal(validCalorieInput({ ...input, image: png }), true);
  assert.equal(validCalorieInput({ kcal: 1, at: "2024-02-29T23:59:59.000" }), true);
});

test("rejects invalid calorie values and calendar dates", () => {
  for (const kcal of [0, -1, 0.5, 100001, NaN, Infinity, "500", true, null]) {
    assert.equal(validCalorieInput({ ...input, kcal }), false, String(kcal));
  }
  for (const at of ["", "2026-02-30T12:30", "2026-02-29T12:30", "2026-13-01T12:30", "2026-09-12T24:00", "2026-09-12T12:00Z"]) {
    assert.equal(validCalorieInput({ ...input, at }), false, at);
  }
  assert.equal(validCalorieInput(null), false);
});

test("rejects external, active, malformed, mislabeled and oversized images", () => {
  for (const image of ["https://example.com/image.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,!!!!", "data:image/png;base64,AAAA", png.replace("png", "jpeg"), {}, 1]) {
    assert.equal(validImage(image), false);
  }
  const tooBig = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  Buffer.from("89504e470d0a1a0a", "hex").copy(tooBig);
  assert.equal(validImage(`data:image/png;base64,${tooBig.toString("base64")}`), false);
});

test("daily totals combine entries by local calendar day without filling missing days", () => {
  const entries = [
    { id: "1", kcal: 200, at: "2026-09-12T00:01:00.000", image: png },
    { id: "2", kcal: 300, at: "2026-09-10T23:59:00.000", image: null },
    { id: "3", kcal: 400, at: "2026-09-12T23:59:00.000", image: null },
  ];
  assert.deepEqual(dailyCalories(entries), [
    { at: "2026-09-10T12:00:00.000", kcal: 300 },
    { at: "2026-09-12T12:00:00.000", kcal: 600 },
  ]);
  assert.equal(entries[0].kcal, 200);
  assert.deepEqual(dailyCalories([]), []);
});

test("both histories use the same period anchor even when their latest entries differ", () => {
  const anchor = Date.parse("2026-09-12T12:00:00.000");
  const entries = [{ at: "2026-07-01T12:00:00.000", kcal: 200 }];
  assert.deepEqual(filterByPeriod(entries, "1M", anchor), []);
  assert.deepEqual(filterByPeriod(entries, "All", anchor), entries);
  assert.deepEqual(filterByPeriod([], "1M", anchor), []);
});


test("period filtering includes the whole boundary day for calorie totals", () => {
  const entries = [
    { at: "2026-08-12T23:59:00.000", kcal: 100 },
    { at: "2026-08-13T00:01:00.000", kcal: 200 },
    { at: "2026-08-13T23:59:00.000", kcal: 300 },
  ];
  const visible = filterByPeriod(entries, "1M", Date.parse("2026-09-12T15:00:00.000"));
  assert.equal(dailyCalories(visible)[0].kcal, 500);
});
