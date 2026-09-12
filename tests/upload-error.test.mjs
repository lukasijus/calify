import assert from "node:assert/strict";
import test from "node:test";
import { calorieSaveError } from "../app/lib/upload-error.ts";

test("proxy HTML 413 gives a clear size error", async () => {
  assert.equal(await calorieSaveError(new Response("<html>too large</html>", { status: 413 })), "Image must be 8 MB or smaller. Choose a smaller image.");
});
test("API validation errors reach the user", async () => {
  assert.equal(await calorieSaveError(Response.json({ error: "image must be JPEG, PNG, or WebP" }, { status: 400 })), "image must be JPEG, PNG, or WebP");
});
test("non-JSON and storage failures use a safe fallback", async () => {
  for (const status of [400, 503]) assert.equal(await calorieSaveError(new Response("unavailable", { status })), "Couldn't save calories. Try again.");
});
