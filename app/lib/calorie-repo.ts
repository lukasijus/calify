import { ensureReady, getPool } from "./db";
import type { CalorieEntry } from "./calorie";

export async function listCalories(): Promise<CalorieEntry[]> {
  await ensureReady();
  const { rows } = await getPool().query<CalorieEntry>(
    'SELECT id, kcal, at, (image IS NOT NULL) AS "hasImage" FROM calorie_entries ORDER BY at, created_at',
  );
  return rows;
}

export async function saveCalories(entry: CalorieEntry, image: Buffer | null, mime: string | null) {
  await ensureReady();
  // One insert keeps the optional photo and its entry atomic.
  await getPool().query(
    "INSERT INTO calorie_entries (id, kcal, at, image, image_mime) VALUES ($1, $2, $3, $4, $5)",
    [entry.id, entry.kcal, entry.at, image, mime],
  );
  return entry;
}

export async function getCalorieImage(id: string) {
  await ensureReady();
  const { rows } = await getPool().query<{ image: Buffer; image_mime: string }>(
    "SELECT image, image_mime FROM calorie_entries WHERE id = $1 AND image IS NOT NULL", [id],
  );
  return rows[0];
}
