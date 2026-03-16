/**
 * In-memory sliding window rate limiter.
 *
 * WARNING: Store is process-local — limits are approximate in multi-instance
 * serverless environments (each worker has its own Map). Acceptable for MVP;
 * swap to a DB-backed table or Redis for stricter enforcement later.
 */

const store = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix ms timestamp when the oldest hit expires (i.e. when a slot frees). */
  resetAt: number;
}

/**
 * Check and record a hit for the given key.
 *
 * @param key       Unique identifier, e.g. "msg:user-uuid" or "forgot-pw:email@example.com"
 * @param limit     Max requests allowed within the window
 * @param windowMs  Sliding window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Prune expired hits, then check count
  const hits = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (hits.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: hits[0] + windowMs,
    };
  }

  hits.push(now);
  store.set(key, hits);

  return {
    allowed: true,
    remaining: limit - hits.length,
    resetAt: hits[0] + windowMs,
  };
}
