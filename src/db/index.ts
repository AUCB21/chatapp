import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Use Supabase's connection pooler (port 6543) for serverless/edge.
 * Direct connection (port 5432) only for migrations.
 */

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Please configure it in your deployment environment or .env.local file."
    );
  }

  const client = postgres(connectionString, {
    prepare: false, // required for Supabase pooler (pgBouncer)
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

// Export a getter that lazily initializes the connection
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});
