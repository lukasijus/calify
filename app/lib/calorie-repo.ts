/** Server-side data access for calorie entries, backed by Postgres. */
import { ensureReady, getPool } from "./db";
import type { CalorieEntry } from "./calorie";

type Row = { id: string; kcal: number; at: string; source: string; has_image: boolean };
type ImageRow = { image_mime: string | null; image_data: Buffer | null };

function toEntry(row: Row): CalorieEntry {
  return {
    id: row.id,
    kcal: Number(row.kcal),
    at: row.at,
    imageUrl: row.has_image ? `/api/calories/${row.id}/image` : null,
    source: "manual",
  };
}

/** All entries, oldest first. `at` is a local-wall-clock ISO string, so a
 * lexicographic sort is chronological. Image bytes are excluded — the client
 * fetches `imageUrl` separately so listing stays cheap. */
export async function listEntries(): Promise<CalorieEntry[]> {
  await ensureReady();
  const { rows } = await getPool().query<Row>(
    `SELECT id, kcal, at, source, (image_data IS NOT NULL) AS has_image
     FROM calorie_entries ORDER BY at ASC, created_at ASC`,
  );
  return rows.map(toEntry);
}

/** Insert a single entry, optionally with an image attached. */
export async function saveEntry(
  entry: Omit<CalorieEntry, "imageUrl">,
  image: { mime: string; data: Buffer } | null,
): Promise<CalorieEntry> {
  await ensureReady();
  await getPool().query(
    `INSERT INTO calorie_entries (id, kcal, at, source, image_mime, image_data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [entry.id, entry.kcal, entry.at, entry.source, image?.mime ?? null, image?.data ?? null],
  );
  return { ...entry, imageUrl: image ? `/api/calories/${entry.id}/image` : null };
}

/** The raw image bytes for one entry, or null if it has none / doesn't exist. */
export async function getEntryImage(
  id: string,
): Promise<{ mime: string; data: Buffer } | null> {
  await ensureReady();
  const { rows } = await getPool().query<ImageRow>(
    "SELECT image_mime, image_data FROM calorie_entries WHERE id = $1",
    [id],
  );
  const row = rows[0];
  if (!row?.image_data || !row.image_mime) return null;
  return { mime: row.image_mime, data: row.image_data };
}
