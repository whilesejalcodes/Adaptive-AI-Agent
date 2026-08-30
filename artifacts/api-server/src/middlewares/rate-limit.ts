import type { RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  maxConcurrent: number;
  message: string;
};

type RateLimitBucket = {
  windowStartedAt: number;
  requestCount: number;
  inFlight: number;
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 10_000;

function pruneExpiredBuckets(now: number, windowMs: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [userId, bucket] of buckets) {
    if (bucket.inFlight === 0 && now - bucket.windowStartedAt >= windowMs) {
      buckets.delete(userId);
    }
  }
}

export function createUserRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const userId = req.user?.uid;
    if (!userId) {
      next();
      return;
    }

    const now = Date.now();
    pruneExpiredBuckets(now, options.windowMs);
    let bucket = buckets.get(userId);
    if (!bucket || now - bucket.windowStartedAt >= options.windowMs) {
      bucket = {
        windowStartedAt: now,
        requestCount: 0,
        inFlight: 0,
      };
      buckets.set(userId, bucket);
    }

    const windowRemainingSeconds = Math.max(
      1,
      Math.ceil((options.windowMs - (now - bucket.windowStartedAt)) / 1_000),
    );
    if (
      bucket.requestCount >= options.maxRequests ||
      bucket.inFlight >= options.maxConcurrent
    ) {
      res.setHeader("Retry-After", windowRemainingSeconds.toString());
      res.status(429).json({ error: options.message });
      return;
    }

    bucket.requestCount += 1;
    bucket.inFlight += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      bucket!.inFlight = Math.max(0, bucket!.inFlight - 1);
      res.removeListener("finish", release);
      res.removeListener("close", release);
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}