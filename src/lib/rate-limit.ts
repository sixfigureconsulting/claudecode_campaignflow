/**
 * Simple in-memory rate limiter.
 * Uses a sliding window per (key). In production with multiple
 * serverless instances you'd back this with Redis/Upstash, but
 * this catches the common cases (brute-force, runaway clients).
 */

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function rateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Convenience: return a 429 Response when rate limited
export function rateLimitResponse(resetAt: number) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  );
}
