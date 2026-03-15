/**
 * Custom migration runner for hybrid drizzle/manual SQL migrations.
 *
 * Reads _journal.json, runs each .sql file in order, and tracks
 * applied migrations in a `__drizzle_migrations` table.
 *
 * Usage: npx tsx src/db/migrate.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL_DIRECT or DATABASE_URL");
  process.exit(1);
}

const migrationsDir = join(__dirname, "migrations");

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

async function migrate() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    // Ensure tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        tag TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Load journal
    const journal: Journal = JSON.parse(
      readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf-8")
    );

    // Get already-applied migrations
    const applied = await sql<{ tag: string }[]>`
      SELECT tag FROM __drizzle_migrations ORDER BY id
    `;
    const appliedSet = new Set(applied.map((r) => r.tag));

    const pending = journal.entries.filter((e) => !appliedSet.has(e.tag));
    if (pending.length === 0) {
      console.log("All migrations already applied.");
      return;
    }

    console.log(`${pending.length} pending migration(s):\n`);

    for (const entry of pending) {
      const filePath = join(migrationsDir, `${entry.tag}.sql`);
      const sqlContent = readFileSync(filePath, "utf-8");

      console.log(`  Running: ${entry.tag}.sql ...`);
      await sql.unsafe(sqlContent);
      await sql`INSERT INTO __drizzle_migrations (tag) VALUES (${entry.tag})`;
      console.log(`  Done: ${entry.tag}`);
    }

    console.log(`\nAll ${pending.length} migration(s) applied successfully.`);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
