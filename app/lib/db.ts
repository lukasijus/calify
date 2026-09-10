/**
 * PostgreSQL connection pool + one-time schema/seed bootstrap.
 *
 * The app talks to a Postgres instance (the `db` service in compose.yaml) over
 * `DATABASE_URL`. Schema creation and the historical import are done lazily on
 * the first query rather than in a separate migration step, so a fresh database
 * — or a fresh per-PR preview database — comes up populated with no extra
 * orchestration. Every statement here is idempotent.
 */
import { Pool, type PoolClient } from "pg";
import { buildSeedEntries } from "./weight-seed";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  }
  return pool;
}

let bootstrap: Promise<void> | undefined;

/** Ensure the schema exists and the historical import has run. Safe to call on
 * every request — the work happens once per process. */
export function ensureReady(): Promise<void> {
  if (!bootstrap) {
    bootstrap = runBootstrap().catch((error) => {
      // Let a later request retry rather than wedging the process forever.
      bootstrap = undefined;
      throw error;
    });
  }
  return bootstrap;
}

async function runBootstrap(): Promise<void> {
  const db = getPool();

  // The app container can start before Postgres finishes accepting connections.
  for (let attempt = 1; ; attempt++) {
    try {
      await db.query("SELECT 1");
      break;
    } catch (error) {
      if (attempt >= 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  const client = await db.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS weight_entries (
        id         TEXT PRIMARY KEY,
        kg         DOUBLE PRECISION NOT NULL CHECK (kg > 0 AND kg <= 700),
        at         TEXT NOT NULL,
        source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await seedHistorical(client);
  } finally {
    client.release();
  }
}

/**
 * Import the canonical historical weigh-ins (issue #6) the first time the table
 * is empty. These are the "existing points" every client used to seed into
 * localStorage; they now live in one shared place. `ON CONFLICT DO NOTHING`
 * keeps this safe even if two processes race on an empty table.
 */
async function seedHistorical(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ present: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM weight_entries) AS present",
  );
  if (rows[0]?.present) return;

  const seed = buildSeedEntries();
  const columns: string[] = [];
  const values: unknown[] = [];
  seed.forEach((entry, index) => {
    const base = index * 4;
    columns.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    values.push(entry.id, entry.kg, entry.at, entry.source);
  });

  await client.query(
    `INSERT INTO weight_entries (id, kg, at, source)
     VALUES ${columns.join(", ")}
     ON CONFLICT (id) DO NOTHING`,
    values,
  );
}
