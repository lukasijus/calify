/** Server-side data access for weight entries, backed by Postgres. */
import { ensureReady, getPool } from "./db";
import type { WeightEntry } from "./weight";

type Row = { id: string; kg: number; at: string; source: string };

function toEntry(row: Row): WeightEntry {
  return {
    id: row.id,
    kg: Number(row.kg),
    at: row.at,
    source: row.source === "import" ? "import" : "manual",
  };
}

/** All entries, oldest first. `at` is a local-wall-clock ISO string, so a
 * lexicographic sort is chronological. */
export async function listEntries(): Promise<WeightEntry[]> {
  await ensureReady();
  const { rows } = await getPool().query<Row>(
    "SELECT id, kg, at, source FROM weight_entries ORDER BY at ASC, created_at ASC",
  );
  return rows.map(toEntry);
}

/** Insert (or replace, by id) a single entry. */
export async function saveEntry(entry: WeightEntry): Promise<WeightEntry> {
  await ensureReady();
  await getPool().query(
    `INSERT INTO weight_entries (id, kg, at, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET kg = EXCLUDED.kg, at = EXCLUDED.at`,
    [entry.id, entry.kg, entry.at, entry.source],
  );
  return entry;
}
