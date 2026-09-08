import test from 'node:test';
import assert from 'node:assert/strict';
import { parseData, localDateTime, dailyFoods, calorieTotal } from '../app/tracker.ts';

test('saved entries and photos survive serialization without losing optional zero calories', () => {
  const data = {
    weights: [{ id: 'w1', kg: 75.5, at: '2026-09-08T10:00:00.000Z' }],
    foods: [
      { id: 'f1', description: 'Lunch', at: '2026-09-08T10:00:00.000Z', photo: 'data:image/jpeg;base64,/9j/', calories: 0 },
      { id: 'f2', description: 'Snack', at: '2026-09-08T11:00:00.000Z' },
    ],
  };
  assert.deepEqual(parseData(JSON.stringify(data)), data);
  assert.deepEqual(parseData(null), { weights: [], foods: [] });
});

test('corrupt or invalid stored data is rejected rather than silently reset', () => {
  for (const raw of ['{', 'null', '{}', '{"weights":[],"foods":[null]}', JSON.stringify({ weights: [{ id: 'w', at: 'bad', kg: 75 }], foods: [] }), JSON.stringify({ weights: [], foods: [{ id: 'f', at: '2026-09-08', description: 'Food', calories: -1 }] })]) {
    assert.throws(() => parseData(raw));
  }
});

test('daily feed uses local calendar dates, including midnight, and sorts newest first', () => {
  const before = new Date(2026, 8, 7, 23, 59);
  const midnight = new Date(2026, 8, 8, 0, 0);
  const later = new Date(2026, 8, 8, 12, 0);
  const foods = [before, midnight, later].map((at, i) => ({ id: String(i), description: 'Meal', at: at.toISOString() }));
  assert.equal(localDateTime(midnight), '2026-09-08T00:00');
  assert.deepEqual(dailyFoods(foods, '2026-09-08').map((food) => food.id), ['2', '1']);
});

test('daily totals distinguish unrecorded calories from an explicit zero', () => {
  assert.equal(calorieTotal([]), null);
  assert.equal(calorieTotal([{ description: 'Unknown' }]), null);
  assert.equal(calorieTotal([{ calories: 0 }]), 0);
  assert.equal(calorieTotal([{ calories: 450 }, {}, { calories: 125 }]), 575);
});
