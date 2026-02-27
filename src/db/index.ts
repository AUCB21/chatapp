import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Use Supabase's connection pooler (port 6543) for serverless/edge.
 * Direct connection (port 5432) only for migrations.
 */
const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  prepare: false, // required for Supabase pooler (pgBouncer)
});

export const db = drizzle(client, { schema });
