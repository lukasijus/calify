import { ensureReady, getPool } from "./db";
import type { CalorieEntry } from "./calories";

export async function listCalorieEntries(): Promise<CalorieEntry[]> {
  await ensureReady();
  const { rows } = await getPool().query<CalorieEntry>(
    "SELECT id, kcal, at, image FROM calorie_entries ORDER BY at ASC, created_at ASC",
  );
  return rows;
}

export async function saveCalorieEntry(entry: CalorieEntry): Promise<CalorieEntry> {
  await ensureReady();
  await getPool().query(
    "INSERT INTO calorie_entries (id, kcal, at, image) VALUES ($1, $2, $3, $4)",
    [entry.id, entry.kcal, entry.at, entry.image],
  );
  return entry;
}
