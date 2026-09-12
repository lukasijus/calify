import { NextResponse } from "next/server";
import { getEntryImage } from "../../../../lib/calorie-repo";

// Image bytes live in Postgres and can change per-request; never prerender.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const image = await getEntryImage(id);
    if (!image) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "content-type": image.mime,
        // Entries are immutable once saved, so this is safe to cache hard.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/calories/[id]/image failed", error);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
}
