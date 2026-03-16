import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: "ok",
      db: true,
      latency_ms: Date.now() - start,
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: false, latency_ms: Date.now() - start },
      { status: 503 }
    );
  }
}
