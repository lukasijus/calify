import { NextResponse } from "next/server";
import { listCalorieEntries, saveCalorieEntry } from "../../lib/calorie-repo";
import { MAX_IMAGE_BYTES, validCalorieInput } from "../../lib/calories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ entries: await listCalorieEntries() });
  } catch (error) {
    console.error("GET /api/calories failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // Bound the body while reading, including requests without Content-Length.
  const limit = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 1024;
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "missing body" }, { status: 400 });
  let body: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return NextResponse.json({ error: "image is too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  if (!validCalorieInput(body)) {
    return NextResponse.json({ error: "Enter whole calories (1–100000), a valid date, and optionally a JPEG, PNG or WebP image up to 2 MB." }, { status: 400 });
  }
  try {
    const entry = await saveCalorieEntry({
      id: crypto.randomUUID(), kcal: body.kcal,
      at: body.at.length === 16 ? `${body.at}:00.000` : body.at,
      image: body.image ?? null,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/calories failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}
