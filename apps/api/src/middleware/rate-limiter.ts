import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Creates an in-memory sliding window rate limiter middleware.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later.",
    keyGenerator = (req) => req.ip || "unknown"
  } = options;

  const storage = new Map<string, RateLimitEntry>();

  // Periodically clean expired entries
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of storage.entries()) {
      if (now > entry.resetAt) {
        storage.delete(key);
      }
    }
  }, Math.min(windowMs, 60000));

  if (interval.unref) {
    interval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = storage.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      storage.set(key, entry);
    } else {
      entry.count += 1;
    }

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({
        error: {
          code: "RateLimitExceeded",
          message,
          retryAfter: Math.ceil((entry.resetAt - now) / 1000)
        }
      });
      return;
    }

    next();
  };
}
