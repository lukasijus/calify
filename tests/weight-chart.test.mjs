import assert from 'node:assert/strict';
import test from 'node:test';
import { smoothPath, nearestPoint, dateLabels } from '../app/lib/weight-chart.ts';

test('curve preserves raw endpoints and stays bounded through irregular gaps and reversals', () => {
  const points = [{ x: 0, y: 90 }, { x: 1, y: 110 }, { x: 150, y: 95 }, { x: 151, y: 95 }, { x: 200, y: 105 }];
  const path = smoothPath(points);
  const curves = [...path.matchAll(/C([^CL]+)/g)];
  assert.equal(curves.length, points.length - 1);
  curves.forEach((match, i) => {
    const [x1, y1, x2, y2, x3, y3] = match[1].trim().split(/[ ,]+/).map(Number);
    const a = points[i];
    const b = points[i + 1];
    assert.equal(x3, b.x);
    assert.equal(y3, b.y);
    assert.ok(x1 >= a.x && x2 >= x1 && x3 >= x2);
    for (let step = 0; step <= 100; step++) {
      const t = step / 100;
      const y = (1-t)**3*a.y + 3*(1-t)**2*t*y1 + 3*(1-t)*t*t*y2 + t**3*y3;
      assert.ok(y >= Math.min(a.y, b.y) - 1e-9 && y <= Math.max(a.y, b.y) + 1e-9);
    }
  });
});

test('empty, single, flat and duplicate-time series have finite paths', () => {
  assert.equal(smoothPath([]), '');
  assert.equal(smoothPath([{ x: 5, y: 99 }]), 'M5,99');
  const path = smoothPath([{ x: 5, y: 99 }, { x: 5, y: 101 }, { x: 10, y: 101 }]);
  assert.ok(path.includes('L5,101'));
  assert.ok(!/NaN|Infinity/.test(path));
});

test('selection clamps, snaps at midpoints and resolves exact duplicate times to newest', () => {
  const points = [{ x: 10 }, { x: 30 }, { x: 30 }, { x: 90 }];
  for (const [x, expected] of [[-100, 0], [19, 0], [20, 1], [30, 2], [59, 2], [60, 3], [500, 3]]) {
    assert.equal(nearestPoint(points, x), expected);
  }
  assert.equal(nearestPoint([{ x: 50 }], 90), 0);
});

test('date labels do not overlap on narrow screens or clustered dates', () => {
  for (const width of [220, 270, 340, 680]) {
    const candidates = Array.from({ length: 90 }, (_, i) => ({
      index: i, x: 48 + (i / 89)**3 * (width - 64), text: `${i % 28 + 1} ${i < 30 ? 'Jul' : i < 60 ? 'Aug' : 'Sep'}`,
    }));
    const labels = dateLabels(candidates);
    assert.equal(labels.at(-1).index, 89);
    let right = -Infinity;
    for (const label of labels) {
      const w = label.text.length * 7;
      const left = label.x - (label.anchor === 'end' ? w : label.anchor === 'middle' ? w / 2 : 0);
      assert.ok(left >= right + 20);
      right = left + w;
      assert.ok(right <= width);
    }
  }
});
