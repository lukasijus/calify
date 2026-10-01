import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Exercise the real routes and repository without connecting to a database.
const dbUrl = `data:text/javascript,${encodeURIComponent(`
  export const calls = [];
  export let rows = [];
  let failImage = false;
  export function reset(result = [], fail = false) {
    calls.length = 0; rows = result; failImage = fail;
  }
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (failImage && sql.includes('INSERT INTO calorie_entry_images')) throw new Error('write failed');
      return { rows };
    },
    release() { calls.push({ sql: 'RELEASE' }); }
  };
  export async function ensureReady() {}
  export function getPool() { return { ...client, async connect() { return client; } }; }
`)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./db" && context.parentURL?.endsWith("/calorie-repo.ts")) {
      return { url: dbUrl, shortCircuit: true };
    }
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") && !specifier.endsWith(".ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const db = await import(dbUrl);
const { POST, GET } = await import("../app/api/calories/route.ts");
const { GET: getImage } = await import("../app/api/calories/[id]/image/route.ts");
const { saveEntry } = await import("../app/lib/calorie-repo.ts");
const { MAX_CALORIE_IMAGE_BYTES } = await import("../app/lib/calorie.ts");

function request(files) {
  const form = new FormData();
  form.set("kcal", "650");
  form.set("at", "2026-09-13T12:00");
  for (const file of files) form.append("image", file);
  return new Request("http://localhost/api/calories", { method: "POST", body: form });
}
const photo = (name, type = "image/png") => new File([name], name, { type });

test("zero, one, and multiple images save one calorie total with ordered photo URLs", async () => {
  for (const count of [0, 1, 3]) {
    db.reset();
    const response = await POST(request(Array.from({ length: count }, (_, i) => photo(`${i}.png`))));
    assert.equal(response.status, 201);
    const { entry } = await response.json();
    assert.equal(entry.kcal, 650);
    assert.equal(entry.imageUrls.length, count);
    assert.equal(entry.imageUrl, entry.imageUrls[0] ?? null);
    assert.equal(db.calls.filter(({ sql }) => sql.includes("INSERT INTO calorie_entries (")).length, 1);
    assert.equal(db.calls.filter(({ sql }) => sql.includes("INSERT INTO calorie_entry_images")).length, Math.max(0, count - 1));
    assert.deepEqual(db.calls.slice(-2).map(({ sql }) => sql), ["COMMIT", "RELEASE"]);
    if (count > 1) assert.equal(entry.imageUrls[2], `/api/calories/${entry.id}/image?position=2`);
  }
});

test("an invalid later attachment rejects the whole upload before saving", async () => {
  for (const [file, status] of [
    [photo("bad.gif", "image/gif"), 400],
    [new File([new Uint8Array(MAX_CALORIE_IMAGE_BYTES + 1)], "large.png", { type: "image/png" }), 413],
    ["not a file", 400],
  ]) {
    db.reset();
    const response = await POST(request([photo("first.png"), file]));
    assert.equal(response.status, status);
    assert.equal(db.calls.length, 0);
  }
});

test("a later image storage failure rolls back the entire entry", async () => {
  db.reset([], true);
  const image = { mime: "image/png", data: Buffer.from("photo") };
  await assert.rejects(saveEntry({ id: "entry", kcal: 650, at: "2026-09-13T12:00", source: "manual" }, [image, image]), /write failed/);
  assert.deepEqual(db.calls.slice(-2).map(({ sql }) => sql), ["ROLLBACK", "RELEASE"]);
  assert.equal(db.calls.some(({ sql }) => sql === "COMMIT"), false);
});

test("listing preserves legacy photos and exposes all additional photos after reload", async () => {
  db.reset([
    { id: "legacy", kcal: 100, at: "2026-09-13T12:00", has_image: true, image_positions: [] },
    { id: "multi", kcal: 650, at: "2026-09-13T12:00", has_image: true, image_positions: [1, 2] },
    { id: "plain", kcal: 200, at: "2026-09-13T12:00", has_image: false, image_positions: [] },
  ]);
  const { entries } = await (await GET()).json();
  assert.deepEqual(entries.map((entry) => entry.imageUrls.length), [1, 3, 0]);
  assert.equal(entries[0].imageUrls[0], "/api/calories/legacy/image");
});

test("photo endpoint serves original and additional bytes, validates positions and handles missing photos", async () => {
  for (const position of [0, 2]) {
    db.reset([{ image_mime: "image/png", image_data: Buffer.from(`photo-${position}`) }]);
    const response = await getImage(new Request(`http://localhost/api/calories/entry/image?position=${position}`), { params: Promise.resolve({ id: "entry" }) });
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(await response.text(), `photo-${position}`);
    assert.deepEqual(db.calls[0].values, position === 0 ? ["entry"] : ["entry", position]);
  }
  for (const [position, status] of [["-1", 400], ["abc", 400], ["1.5", 400], ["5", 404]]) {
    db.reset();
    const response = await getImage(new Request(`http://localhost/api/calories/entry/image?position=${position}`), { params: Promise.resolve({ id: "entry" }) });
    assert.equal(response.status, status);
  }
});
