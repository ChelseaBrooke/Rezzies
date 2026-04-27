/**
 * Simple in-memory rate limiter (per server instance). For distributed deploys, add Redis or similar.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function isRateLimited(
	key: string,
	max: number,
	windowMs: number
): { limited: true; retryAfterSec: number } | { limited: false } {
	const now = Date.now();
	const b = buckets.get(key);
	if (!b || now > b.resetAt) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { limited: false };
	}
	if (b.count >= max) {
		return { limited: true, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
	}
	b.count++;
	return { limited: false };
}

/** Default auth endpoints: 25 attempts / 15 minutes / key (usually IP). */
export const AUTH_RATE = { max: 25, windowMs: 15 * 60 * 1000 } as const;
