import { NextResponse } from "next/server";
import { listEntries, saveEntry } from "../../lib/weight-repo";
import type { WeightEntry } from "../../lib/weight";

// Weight data is per-request and lives in Postgres; never prerender this.
export const dynamic = "force-dynamic";

const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

export async function GET() {
  try {
    return NextResponse.json({ entries: await listEntries() });
  } catch (error) {
    console.error("GET /api/weights failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { kg, at } = (body ?? {}) as { kg?: unknown; at?: unknown };

  const kgNumber = typeof kg === "number" ? kg : Number(kg);
  if (!Number.isFinite(kgNumber) || kgNumber <= 0 || kgNumber > 700) {
    return NextResponse.json({ error: "kg must be a number between 0 and 700" }, { status: 400 });
  }

  // The client sends the wall-clock time it captured (no offset); trust the
  // shape, not a server-side `new Date()` which would be in the container's TZ.
  if (typeof at !== "string" || !LOCAL_ISO.test(at) || Number.isNaN(Date.parse(at))) {
    return NextResponse.json({ error: "at must be a local ISO date-time string" }, { status: 400 });
  }

  const entry: WeightEntry = {
    id: crypto.randomUUID(),
    kg: Math.round(kgNumber * 100) / 100,
    at: at.length === 16 ? `${at}:00.000` : at,
    source: "manual",
  };

  try {
    return NextResponse.json({ entry: await saveEntry(entry) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/weights failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}
