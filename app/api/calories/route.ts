import { listCalories, saveCalories } from "../../lib/calorie-repo";
import { imageMime, imageSizeError, MAX_IMAGE_BYTES } from "../../lib/calorie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ entries: await listCalories() });
  } catch (error) {
    console.error("GET /api/calories failed", error);
    return Response.json({ error: "Couldn't load calorie history. Try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // Allow multipart overhead without base64 expansion. Bound the stream even
  // when Content-Length is missing; do not buffer arbitrary uploads in memory.
  const limit = MAX_IMAGE_BYTES + 64 * 1024;
  const tooLarge = () => Response.json({ error: "Image must be 2 MB or smaller. Choose a smaller image." }, { status: 413 });
  if (Number(request.headers.get("content-length")) > limit) return tooLarge();
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
        return tooLarge();
      }
      chunks.push(value);
    }
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return Response.json({ error: "Couldn't read the upload. Choose the image again and retry." }, { status: 400 });
  }
  const kcalValue = form.get("kcal");
  const kcal = typeof kcalValue === "string" ? Number(kcalValue) : NaN;
  const at = form.get("at");
  if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 100000) {
    return Response.json({ error: "Enter calories greater than 0 and no more than 100,000." }, { status: 400 });
  }
  if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(at) || Number.isNaN(Date.parse(`${at}Z`)) || new Date(`${at}Z`).toISOString().slice(0, 16) !== at.slice(0, 16)) {
    return Response.json({ error: "Enter a valid date and time." }, { status: 400 });
  }
  const file = form.get("image");
  let image: Buffer | null = null;
  let mime: string | null = null;
  if (file !== null) {
    if (typeof file === "string") return Response.json({ error: "Choose an image file." }, { status: 400 });
    const error = imageSizeError(file.size);
    if (error) return Response.json({ error }, { status: file.size > MAX_IMAGE_BYTES ? 413 : 400 });
    image = Buffer.from(await file.arrayBuffer());
    mime = imageMime(image);
    if (!mime) return Response.json({ error: "Choose a JPEG, PNG or WebP image. Convert HEIC photos before uploading." }, { status: 415 });
  }
  try {
    const entry = { id: crypto.randomUUID(), kcal, at, hasImage: image !== null };
    return Response.json({ entry: await saveCalories(entry, image, mime) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/calories failed", error);
    return Response.json({ error: "Couldn't save calories. Storage is unavailable; try again." }, { status: 503 });
  }
}
