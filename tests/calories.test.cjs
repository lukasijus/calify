/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test loader for TypeScript route modules. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Exercise the real route and shared helpers without a live database.
function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  const localRequire = name => overrides[name] ?? (name.startsWith(".")
    ? load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), `${name}.ts`)), overrides)
    : require(name));
  new Function("require", "module", "exports", source)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const { MAX_IMAGE_BYTES, imageError, dailyCalories } = load("app/lib/calorie.ts");
const saved = [];
const route = load("app/api/calories/route.ts", {
  "../../lib/calorie-repo": {
    listCalories: async () => saved.map(item => item.entry),
    saveCalories: async (entry, image, type) => { saved.push({ entry, image, type }); return entry; },
  },
});
async function request(image, fields = {}) {
  const data = new FormData();
  data.set("kcal", fields.kcal ?? "1500");
  data.set("at", fields.at ?? "2026-09-12T22:14");
  if (image) data.set("image", image);
  const encoded = new Request("http://localhost/api/calories", { method: "POST", body: data });
  // Buffer the synthetic multipart body so cancelling oversized requests tests
  // the route without Undici's FormData encoder continuing after cancellation.
  return new Request(encoded.url, { method: "POST", headers: encoded.headers, body: await encoded.arrayBuffer() });
}
function jpeg(size) {
  const bytes = new Uint8Array(size);
  bytes.set([255, 216, 255]);
  return new File([bytes], "meal.jpeg", { type: "image/jpeg" });
}

test("image validation accepts the inclusive 8 MiB boundary and rejects unsupported files", () => {
  assert.equal(imageError({ size: MAX_IMAGE_BYTES, type: "image/jpeg" }), null);
  assert.match(imageError({ size: MAX_IMAGE_BYTES + 1, type: "image/jpeg" }), /8 MB/);
  assert.match(imageError({ size: 10, type: "image/svg+xml" }), /JPEG/);
});

test("route saves calories without an image and with images above the old limit, up to 8 MiB", async () => {
  for (const image of [null, jpeg(3 * 1024 * 1024), jpeg(MAX_IMAGE_BYTES)]) {
    const response = await route.POST(await request(image));
    assert.equal(response.status, 201);
    const { entry } = await response.json();
    assert.equal(entry.kcal, 1500);
    assert.equal(entry.at, "2026-09-12T22:14:00.000");
    assert.equal(entry.hasImage, image !== null);
    assert.equal(saved.at(-1).image?.length ?? 0, image?.size ?? 0);
  }
});

test("oversized, invalid and malformed uploads never reach storage", async () => {
  const before = saved.length;
  assert.equal((await route.POST(await request(jpeg(MAX_IMAGE_BYTES + 1)))).status, 413);
  assert.equal((await route.POST(await request(jpeg(MAX_IMAGE_BYTES + 100000)))).status, 413);
  assert.equal((await route.POST(await request(new File(["not a PNG"], "bad.png", { type: "image/png" })))).status, 400);
  assert.equal((await route.POST(await request(null, { kcal: "-5" })) ).status, 400);
  assert.equal((await route.POST(await request(null, { at: "invalid" })) ).status, 400);
  assert.equal((await route.POST(await request(null, { at: "2026-02-31T12:00" })) ).status, 400);
  assert.equal((await route.POST(new Request("http://localhost/api/calories", { method: "POST", body: "broken" }))).status, 400);
  assert.equal(saved.length, before);
});

test("storage failures return a retryable error without reporting a successful save", async () => {
  const failing = load("app/api/calories/route.ts", {
    "../../lib/calorie-repo": { saveCalories: async () => { throw new Error("test storage failure"); } },
  });
  const response = await failing.POST(await request(null));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Try again/);
});

test("history excludes image bytes; daily totals group by the entered local day", async () => {
  const body = await (await route.GET()).json();
  assert.equal("image" in body.entries[0], false);
  assert.deepEqual(dailyCalories([
    { at: "2026-09-13T00:01", kcal: 20 },
    { at: "2026-09-12T23:59", kcal: 100 },
    { at: "2026-09-12T09:00", kcal: 50 },
  ]), [{ day: "2026-09-12", kcal: 150 }, { day: "2026-09-13", kcal: 20 }]);
});

test("period filtering uses the latest entry across both series", () => {
  const { filterByPeriod } = load("app/lib/weight.ts");
  const recent = { at: "2026-09-12T12:00", kcal: 50 };
  assert.deepEqual(filterByPeriod([{ at: "2026-01-01T12:00", kg: 90 }, recent], "1M"), [recent]);
});

test("image endpoint returns bytes with a safe content type, or 404 when absent", async () => {
  const imageRoute = load("app/api/calories/[id]/image/route.ts", {
    "../../../../lib/calorie-repo": {
      getCalorieImage: async id => id === "meal"
        ? { image: Buffer.from([255, 216, 255]), image_type: "image/jpeg" } : undefined,
    },
  });
  const response = await imageRoute.GET(null, { params: Promise.resolve({ id: "meal" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([255, 216, 255]));
  assert.equal((await imageRoute.GET(null, { params: Promise.resolve({ id: "missing" }) })).status, 404);
});
