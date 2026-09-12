import { imageError, MAX_IMAGE_BYTES } from "../../lib/calorie";
import { listCalories, saveCalories } from "../../lib/calorie-repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ entries: await listCalories() });
  } catch (error) {
    console.error("GET /api/calories failed", error);
    return Response.json({ error: "Couldn't load calories. Try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // Bound the multipart body even when Content-Length is absent. Allow room
  // for field values and multipart headers beyond the image's 8 MiB limit.
  const limit = MAX_IMAGE_BYTES + 64 * 1024;
  let form: FormData;
  try {
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Missing form data." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return Response.json({ error: "Image must be 8 MB or smaller. Choose a smaller image." }, { status: 413 });
      }
      chunks.push(value);
    }
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return Response.json({ error: "Invalid upload. Choose the image again." }, { status: 400 });
  }
  const kcalValue = form.get("kcal");
  const kcal = typeof kcalValue === "string" ? Number(kcalValue) : NaN;
  const at = form.get("at");
  if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 100000) {
    return Response.json({ error: "Enter calories greater than 0 and at most 100000." }, { status: 400 });
  }
  if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)
    || Number.isNaN(Date.parse(`${at}Z`)) || new Date(`${at}Z`).toISOString().slice(0, 16) !== at) {
    return Response.json({ error: "Enter a valid date and time." }, { status: 400 });
  }
  const image = form.get("image");
  let bytes: Buffer | null = null;
  let type: string | null = null;
  if (image !== null) {
    if (typeof image === "string") return Response.json({ error: "Invalid image." }, { status: 400 });
    const error = imageError(image);
    if (error) return Response.json({ error }, { status: image.size > MAX_IMAGE_BYTES ? 413 : 400 });
    bytes = Buffer.from(await image.arrayBuffer());
    type = image.type;
    const valid = type === "image/jpeg" ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid) return Response.json({ error: "Image contents must be JPEG, PNG or WebP." }, { status: 400 });
  }
  try {
    const entry = { id: crypto.randomUUID(), kcal, at: `${at}:00.000`, hasImage: bytes !== null };
    return Response.json({ entry: await saveCalories(entry, bytes, type) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/calories failed", error);
    return Response.json({ error: "Couldn't save calories. Try again." }, { status: 503 });
  }
}
