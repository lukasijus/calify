import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ellipseCircumference, measure, silhouetteRow } from '../lib/geometry.ts';
import { parseSessions } from '../lib/sessions.ts';
const reference: [{x:number;y:number},{x:number;y:number}] = [{ x: 10, y: 10 }, { x: 110, y: 10 }];
test('independent calibrated front/side scales and horizontal width', () => {
  assert.equal(measure([{x:0,y:0},{x:150,y:0}], reference, 20, 'front').cm, 30);
  assert.equal(measure([{x:150,y:0},{x:0,y:0}], reference, 20, 'side').cm, 30);
  assert.equal(measure([{x:0,y:0},{x:100,y:0}], reference, 20, 'side').view, 'side');
});
test('rejects invalid scale, degenerate edges and tilted reference', () => {
  for (const size of [0, -1, NaN, Infinity]) assert.throws(() => measure(reference, reference, size, 'front'));
  assert.throws(() => measure(reference, [{x:0,y:0},{x:0,y:100}], 20, 'front'));
  assert.throws(() => measure(reference, [{x:0,y:0},{x:1,y:0}], 20, 'front'));
  assert.throws(() => measure([{x:0,y:0},{x:0,y:0}], reference, 20, 'front'));
});
test('Ramanujan II matches a circle and known ellipse and is symmetric', () => {
  assert.ok(Math.abs(ellipseCircumference(20, 20) - Math.PI * 20) < 1e-10);
  assert.ok(Math.abs(ellipseCircumference(40, 20) - 96.88448) < .001);
  assert.equal(ellipseCircumference(40,20), ellipseCircumference(20,40));
  assert.throws(() => ellipseCircumference(0,20));
});
test('seeded segmentation detects contrasting body and rejects missing boundaries', () => {
  const width = 20, height = 4;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y=0; y<height; y++) for (let x=6; x<=13; x++) for (let c=0; c<3; c++) data[(y*width+x)*4+c]=0;
  assert.deepEqual(silhouetteRow(data,width,height,{x:10,y:2},{x:1,y:2}), [{x:6,y:2},{x:13,y:2}]);
  assert.throws(() => silhouetteRow(data,width,height,{x:1,y:2},{x:1,y:2}));
  assert.throws(() => silhouetteRow(data,width,height,{x:25,y:2},{x:1,y:2}));
});
test('history roundtrip preserves measurements and rejects corrupt data', () => {
  const front = measure(reference,reference,20,'front'), side = measure(reference,reference,20,'side');
  const session = {id:'test',timestamp:'2026-09-05T12:00:00Z',weightKg:70,measurements:{waistWidth:front,waistDepth:side,shoulderWidth:front,hipWidth:front},waistCircumference:{cm:ellipseCircumference(20,20),estimated:true,quality:'manual-review',warnings:['Estimate']}};
  assert.deepEqual(parseSessions(JSON.stringify([session])), [session]);
  assert.deepEqual(parseSessions(null), []);
  assert.throws(() => parseSessions('{'));
  assert.throws(() => parseSessions('[{}]'));
  assert.throws(() => parseSessions(JSON.stringify([{...session,weightKg:-1}])));
});
