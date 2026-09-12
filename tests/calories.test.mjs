import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Compile the actual handlers, then substitute only persistence. No database or
// running Next server is required to exercise multipart parsing and responses.
const output = mkdtempSync(join(tmpdir(), 'calify-tests-'));
after(() => rmSync(output, { recursive: true, force: true }));
const program = ts.createProgram([
  'app/api/calories/route.ts', 'app/api/calories/[id]/image/route.ts',
], {
  outDir: output, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  esModuleInterop: true, skipLibCheck: true, strict: true,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
program.emit();
let saved;
let storageUnavailable = false;
const repository = join(output, 'lib/calorie-repo.js');
require.cache[repository] = { exports: {
  listCalories: async () => saved ? [saved.entry] : [],
  saveCalories: async (entry, image, mime) => {
    if (storageUnavailable) throw new Error('test storage failure');
    saved = { entry, image, mime };
    return entry;
  },
  getCalorieImage: async (id) => saved?.entry.id === id && saved.image
    ? { image: saved.image, image_mime: saved.mime } : undefined,
} };
const { POST, GET } = require(join(output, 'api/calories/route.js'));
const { GET: getImage } = require(join(output, 'api/calories/[id]/image/route.js'));
const { MAX_IMAGE_BYTES, dailyCalories } = require(join(output, 'lib/calorie.js'));
const { filterByPeriod } = require(join(output, 'lib/weight.js'));

function request(image, fields = {}) {
  const form = new FormData();
  form.set('kcal', fields.kcal ?? '50');
  form.set('at', fields.at ?? '2026-09-12T21:38');
  if (image) form.set('image', image, 'photo.jpeg');
  return new Request('http://localhost/api/calories', { method: 'POST', body: form });
}

test('calories save without an image and list without image bytes', async () => {
  const response = await POST(request());
  assert.equal(response.status, 201);
  const { entry } = await response.json();
  assert.equal(entry.kcal, 50);
  assert.equal(entry.at, '2026-09-12T21:38');
  assert.equal(entry.hasImage, false);
  assert.equal(saved.image, null);
  assert.deepEqual(await (await GET()).json(), { entries: [entry] });
});

test('2 MB multipart image works with missing MIME metadata and round-trips as binary', async () => {
  const bytes = Buffer.alloc(MAX_IMAGE_BYTES);
  bytes.set([0xff, 0xd8, 0xff]);
  const response = await POST(request(new Blob([bytes])));
  assert.equal(response.status, 201);
  const { entry } = await response.json();
  assert.equal(entry.hasImage, true);
  assert.equal(saved.mime, 'image/jpeg');
  const image = await getImage(null, { params: Promise.resolve({ id: entry.id }) });
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
});

test('oversized, empty and unsupported files return actionable errors without saving', async () => {
  const previous = saved;
  for (const [blob, status, message] of [
    [new Blob([Buffer.alloc(MAX_IMAGE_BYTES + 1)]), 413, /2 MB/],
    [new Blob([]), 400, /empty/],
    [new Blob(['not an image'], { type: 'image/jpeg' }), 415, /JPEG, PNG or WebP/],
  ]) {
    const response = await POST(request(blob));
    assert.equal(response.status, status);
    assert.match((await response.json()).error, message);
    assert.equal(saved, previous);
  }
});

test('PNG and WebP signatures override misleading filename and MIME type', async () => {
  for (const [bytes, mime] of [
    [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
    [Buffer.from('RIFF0000WEBP'), 'image/webp'],
  ]) {
    const response = await POST(request(new Blob([bytes], { type: 'application/octet-stream' })));
    assert.equal(response.status, 201);
    assert.equal(saved.mime, mime);
  }
});

test('request size is bounded without a Content-Length header', async () => {
  const response = await POST(new Request('http://localhost/api/calories', {
    method: 'POST', body: new Blob([Buffer.alloc(MAX_IMAGE_BYTES + 65537)]),
  }));
  assert.equal(response.status, 413);
});

test('invalid values, timestamps and malformed multipart do not save', async () => {
  const previous = saved;
  for (const fields of [{ kcal: '0' }, { kcal: 'NaN' }, { kcal: '100001' }, { at: 'yesterday' }, { at: '2026-09-12T21:38Z' }, { at: '2026-02-31T12:00' }]) {
    assert.equal((await POST(request(null, fields))).status, 400);
  }
  assert.equal((await POST(new Request('http://localhost/api/calories', { method: 'POST', body: 'bad multipart' }))).status, 400);
  assert.equal(saved, previous);
});

test('storage failure returns a retryable error and missing photos return 404', async () => {
  storageUnavailable = true;
  const response = await POST(request());
  storageUnavailable = false;
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /try again/);
  assert.equal((await getImage(null, { params: Promise.resolve({ id: 'missing' }) })).status, 404);
});

test('calories aggregate by local day and both series use the same period anchor', () => {
  const entries = [
    { at: '2026-09-12T23:59', kcal: 50 },
    { at: '2026-09-11T12:00', kcal: 100 },
    { at: '2026-09-12T00:01', kcal: 75 },
  ];
  assert.deepEqual(dailyCalories(entries), [{ day: '2026-09-11', kcal: 100 }, { day: '2026-09-12', kcal: 125 }]);
  assert.deepEqual(dailyCalories([]), []);
  assert.deepEqual(filterByPeriod([{ at: '2026-07-01T12:00', kg: 90 }], '1M', '2026-09-12T23:59'), []);
  assert.equal(filterByPeriod(entries, '1M', '2026-09-12T23:59').length, 3);
});
