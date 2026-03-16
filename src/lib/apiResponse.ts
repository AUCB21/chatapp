import { NextResponse } from "next/server";

/**
 * Typed API response helpers.
 * Centralizes status codes and error shapes across all routes.
 */
export const ok = <T>(data: T) =>
  NextResponse.json({ data }, { status: 200 });

export const created = <T>(data: T) =>
  NextResponse.json({ data }, { status: 201 });

export const unauthorized = (message = "Unauthorized") =>
  NextResponse.json({ error: message }, { status: 401 });

export const forbidden = (message = "Forbidden") =>
  NextResponse.json({ error: message }, { status: 403 });

export const badRequest = (message = "Bad request") =>
  NextResponse.json({ error: message }, { status: 400 });

export const notFound = (message = "Not found") =>
  NextResponse.json({ error: message }, { status: 404 });

export const tooManyRequests = (retryAfterSecs: number) =>
  NextResponse.json({ error: "Too many requests" }, {
    status: 429,
    headers: { "Retry-After": String(retryAfterSecs) },
  });

export const serverError = (message = "Internal server error", error?: unknown) => {
  // Log error details to server console for debugging
  if (error) {
    console.error("[API Error]", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
  }
  return NextResponse.json({ error: message }, { status: 500 });
};
