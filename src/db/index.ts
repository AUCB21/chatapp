import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Use Supabase's connection pooler (port 6543) for serverless/edge.
 * Direct connection (port 5432) only for migrations.
 */
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

export const db = drizzle(client, { schema });
