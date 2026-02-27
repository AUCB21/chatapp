import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use direct connection (port 5432) for migrations, NOT the pooler
    url: process.env.DATABASE_URL_DIRECT!,
  },
} satisfies Config;
