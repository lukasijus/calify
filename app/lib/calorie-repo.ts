/** Server-side data access for calorie entries, backed by Postgres. */
import { ensureReady, getPool } from "./db";
import type { CalorieEntry } from "./calorie";

type Row = { id: string; kcal: number; at: string; source: string; has_image: boolean; image_positions: number[] };
type ImageRow = { image_mime: string | null; image_data: Buffer | null };
type CalorieImage = { mime: string; data: Buffer };

function imageUrls(id: string, hasImage: boolean, positions: number[]): string[] {
  return [
    ...(hasImage ? [`/api/calories/${id}/image`] : []),
    ...positions.map((position) => `/api/calories/${id}/image?position=${position}`),
  ];
}

/** All entries, oldest first. Image bytes are fetched separately. */
export async function listEntries(): Promise<CalorieEntry[]> {
  await ensureReady();
  const { rows } = await getPool().query<Row>(
    `SELECT id, kcal, at, source, (image_data IS NOT NULL) AS has_image,
       ARRAY(SELECT position FROM calorie_entry_images
             WHERE entry_id = calorie_entries.id ORDER BY position) AS image_positions
     FROM calorie_entries ORDER BY at ASC, created_at ASC`,
  );
  return rows.map((row) => ({
    id: row.id,
    kcal: Number(row.kcal),
    at: row.at,
    imageUrl: row.has_image ? `/api/calories/${row.id}/image` : null,
    imageUrls: imageUrls(row.id, row.has_image, row.image_positions),
    source: "manual",
  }));
}

/** Save the calorie total and all photos atomically. */
export async function saveEntry(
  entry: Omit<CalorieEntry, "imageUrl" | "imageUrls">,
  images: CalorieImage[],
): Promise<CalorieEntry> {
  await ensureReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const first = images[0];
    await client.query(
      `INSERT INTO calorie_entries (id, kcal, at, source, image_mime, image_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.id, entry.kcal, entry.at, entry.source, first?.mime ?? null, first?.data ?? null],
    );
    for (let position = 1; position < images.length; position++) {
      await client.query(
        `INSERT INTO calorie_entry_images (entry_id, position, image_mime, image_data)
         VALUES ($1, $2, $3, $4)`,
        [entry.id, position, images[position].mime, images[position].data],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const urls = imageUrls(entry.id, images.length > 0, images.slice(1).map((_, index) => index + 1));
  return { ...entry, imageUrl: urls[0] ?? null, imageUrls: urls };
}

/** Position zero preserves the original single-photo URL and storage. */
export async function getEntryImage(
  id: string,
  position = 0,
): Promise<CalorieImage | null> {
  await ensureReady();
  const { rows } = position === 0
    ? await getPool().query<ImageRow>(
      "SELECT image_mime, image_data FROM calorie_entries WHERE id = $1", [id],
    )
    : await getPool().query<ImageRow>(
      "SELECT image_mime, image_data FROM calorie_entry_images WHERE entry_id = $1 AND position = $2",
      [id, position],
    );
  const row = rows[0];
  if (!row?.image_data || !row.image_mime) return null;
  return { mime: row.image_mime, data: row.image_data };
}
