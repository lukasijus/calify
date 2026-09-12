import { NextResponse } from "next/server";
import { listEntries, saveEntry } from "../../lib/calorie-repo";
import { ALLOWED_CALORIE_IMAGE_TYPES, MAX_CALORIE_IMAGE_BYTES } from "../../lib/calorie";
import type { CalorieEntry } from "../../lib/calorie";
import { LOCAL_ISO, normalizeLocalIso } from "../../lib/date";

// Calorie data is per-request and lives in Postgres; never prerender this.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ entries: await listEntries() });
  } catch (error) {
    console.error("GET /api/calories failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const kcalRaw = form.get("kcal");
  const kcalNumber = typeof kcalRaw === "string" ? Number(kcalRaw) : NaN;
  if (!Number.isFinite(kcalNumber) || kcalNumber <= 0 || kcalNumber > 20_000) {
    return NextResponse.json({ error: "kcal must be a number between 0 and 20000" }, { status: 400 });
  }

  const at = form.get("at");
  // The client sends the wall-clock time it captured (no offset); trust the
  // shape, not a server-side `new Date()` which would be in the container's TZ.
  if (typeof at !== "string" || !LOCAL_ISO.test(at) || Number.isNaN(Date.parse(at))) {
    return NextResponse.json({ error: "at must be a local ISO date-time string" }, { status: 400 });
  }

  let image: { mime: string; data: Buffer } | null = null;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_CALORIE_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_CALORIE_IMAGE_TYPES)[number])) {
      return NextResponse.json({ error: "image must be JPEG, PNG, or WebP" }, { status: 400 });
    }
    if (file.size > MAX_CALORIE_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `image must be ${MAX_CALORIE_IMAGE_BYTES / (1024 * 1024)} MB or smaller` },
        { status: 413 },
      );
    }
    image = { mime: file.type, data: Buffer.from(await file.arrayBuffer()) };
  }

  const entry: Omit<CalorieEntry, "imageUrl"> = {
    id: crypto.randomUUID(),
    kcal: Math.round(kcalNumber),
    at: normalizeLocalIso(at),
    source: "manual",
  };

  try {
    return NextResponse.json({ entry: await saveEntry(entry, image) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/calories failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}
