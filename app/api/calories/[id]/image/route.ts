import { getCalorieImage } from "../../../../lib/calorie-repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const row = await getCalorieImage(id);
    if (!row) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(row.image), {
      headers: {
        "Content-Type": row.image_mime,
        "Content-Length": String(row.image.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("GET calorie image failed", error);
    return new Response(null, { status: 503 });
  }
}
