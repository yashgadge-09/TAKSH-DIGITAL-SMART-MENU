import "server-only";

/**
 * Best-effort in-memory rate limiter (fixed window).
 *
 * NOTE: state lives in the process memory of a single serverless instance, so
 * under heavy scale-out the effective limit is `limit × warm-instances`. That is
 * fine for the threat this guards against — a single client flooding an
 * unauthenticated endpoint (e.g. /api/save-token spamming push_sessions). For a
 * hard, cross-instance guarantee, back this with Redis/Vercel KV instead.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Occasional sweep so the Map can't grow unbounded on a long-lived instance.
function sweep(now: number) {
  if (store.size < 5000) return;
  store.forEach((bucket, key) => {
    if (now >= bucket.resetAt) store.delete(key);
  });
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);

  const bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count++;
  return { allowed: true, retryAfterSec: 0 };
}

/** Extract the caller's IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
