import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readLocal, writeLocal, upsertWeight, validWeights, validProfile, validResult } from '../lib/local-data.ts';
const board = JSON.parse(readFileSync(new URL('../public/calibration/board.json', import.meta.url), 'utf8'));
const result = { resolution: [1280, 960], cameraMatrix: [[1000,0,640],[0,1000,480],[0,0,1]], distortion: [0,0,0,0,0], rms: 0.2, perViewErrors: Array(8).fill(0.2), usableImages: 8 };

test('weights persist and edit by date without inventing records', () => {
  const data = new Map<string,string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  assert.deepEqual(readLocal(storage, 'weights', validWeights, []), []);
  let weights = upsertWeight([], { date: '2026-09-08', kg: 75 });
  weights = upsertWeight(weights, { date: '2026-09-07', kg: 76 });
  weights = upsertWeight(weights, { date: '2026-09-08', kg: 74.5 });
  writeLocal(storage, 'weights', weights);
  assert.deepEqual(readLocal(storage, 'weights', validWeights, []), [{ date: '2026-09-07', kg: 76 }, { date: '2026-09-08', kg: 74.5 }]);
  assert.throws(() => upsertWeight(weights, { date: '2026-02-30', kg: 75 }));
  assert.throws(() => upsertWeight(weights, { date: '2026-02-20', kg: NaN }));
});
test('corruption and storage failure are surfaced, not overwritten', () => {
  assert.throws(() => readLocal({ getItem: () => '{broken' }, 'weights', validWeights, []));
  assert.throws(() => readLocal({ getItem: () => '[{"date":"bad","kg":-1}]' }, 'weights', validWeights, []));
  assert.throws(() => writeLocal({ setItem: () => { throw new Error('quota'); } }, 'weights', []), /quota/);
});
test('incomplete, nonfinite and poor-fit calibration cannot become valid profiles', () => {
  const profile = { ...result, version: 1, board, camera: 'Test camera', lens: '1x fixed', timestamp: '2026-09-08T10:00:00Z' };
  assert.ok(validProfile(profile, board));
  let saved = '';
  writeLocal({ setItem: (_key, value) => { saved = value; } }, 'profile', profile);
  assert.deepEqual(readLocal({ getItem: () => saved }, 'profile', (v): v is typeof profile => validProfile(v, board), profile), profile);
  assert.ok(!validProfile({ ...profile, board: { ...board, markerMm: 20 } }, board));
  assert.ok(!validProfile({ ...profile, camera: '' }, board));
  for (const patch of [{ rms: 3 }, { rms: NaN }, { usableImages: 0 }, { perViewErrors: [] }, { cameraMatrix: [] }, { distortion: [NaN, 0, 0, 0, 0] }]) {
    assert.ok(!validResult({ ...result, ...patch }));
  }
  assert.ok(!validResult({ checklist: true }));
});
test('board definition has A4 dimensions, exact marker cells and adequate margins', () => {
  assert.equal(board.widthMm, board.squaresX * board.squareMm);
  assert.equal(board.heightMm, board.squaresY * board.squareMm);
  assert.deepEqual([board.pageWidthMm, board.pageHeightMm], [210,297]);
  assert.equal(board.markerMm % 7, 0);
  assert.ok(board.markerMm < board.squareMm);
  assert.ok(board.widthMm < 190 && board.heightMm < 277);
  assert.equal(board.legacyPattern, false);
});
