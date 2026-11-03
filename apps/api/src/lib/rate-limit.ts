import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { getSessionSecret } from "./session-secret.js";
import { logger } from "./logger.js";

export type SharedRateCounter = (key: string, windowStart: Date, expiresAt: Date) => Promise<number>;
const localBuckets = new Map<string, { windowStart: number; count: number }>();
let warnedLocalFallback = false;

export async function incrementSharedRateLimit(key: string, windowStart: Date, expiresAt: Date, client?: any) {
  const database = client || (await import("./db.js")).db;
  const rows = await database.$queryRawUnsafe(
    `INSERT INTO "ApiRateLimitBucket" ("key", "windowStart", "count", "expiresAt")
     VALUES ($1, $2, 1, $3)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE WHEN "ApiRateLimitBucket"."windowStart" <> EXCLUDED."windowStart" THEN 1 ELSE "ApiRateLimitBucket"."count" + 1 END,
       "windowStart" = EXCLUDED."windowStart",
       "expiresAt" = EXCLUDED."expiresAt"
     RETURNING "count"`,
    key, windowStart, expiresAt,
  );
  return Number((rows as Array<{ count: number }>)[0]?.count || 0);
}

export function createSharedRateLimiter(options: {
  scope: string;
  limit: number;
  windowMs: number;
  increment?: SharedRateCounter;
}) {
  const counter = options.increment || ((key, start, expiry) => incrementSharedRateLimit(key, start, expiry));
  return async (req: Request, res: Response, next: NextFunction) => {
    const windowStartMs = Math.floor(Date.now() / options.windowMs) * options.windowMs;
    const windowStart = new Date(windowStartMs);
    const expiresAt = new Date(windowStartMs + options.windowMs * 2);
    const address = req.ip || req.socket.remoteAddress || "unknown";
    const key = crypto.createHmac("sha256", getSessionSecret()).update(`${options.scope}\0${address}`).digest("hex");
    try {
      const count = await counter(key, windowStart, expiresAt);
      if (count > options.limit) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((windowStartMs + options.windowMs - Date.now()) / 1000))));
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
      return next();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        if (!warnedLocalFallback) {
          warnedLocalFallback = true;
          logger.warn("shared_rate_limit_table_unavailable_using_local_development_counter");
        }
        const current = localBuckets.get(key);
        const count = !current || current.windowStart !== windowStartMs
          ? 1
          : current.count + 1;
        localBuckets.set(key, { windowStart: windowStartMs, count });
        if (count > options.limit) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil((windowStartMs + options.windowMs - Date.now()) / 1000))));
          return res.status(429).json({ error: "Too many requests. Please try again later." });
        }
        return next();
      }
      logger.error("shared_rate_limit_store_unavailable", { scope: options.scope, error });
      return res.status(503).json({ error: "Request protection is temporarily unavailable." });
    }
  };
}

export async function cleanExpiredRateLimitBuckets(client?: any) {
  const database = client || (await import("./db.js")).db;
  return database.$executeRawUnsafe(
    `DELETE FROM "ApiRateLimitBucket" WHERE ctid IN (
       SELECT ctid FROM "ApiRateLimitBucket" WHERE "expiresAt" < $1 LIMIT 1000
     )`,
    new Date(),
  );
}

export function startRateLimitCleanup() {
  const timer = setInterval(() => {
    void cleanExpiredRateLimitBuckets().catch((error) => logger.warn("rate_limit_cleanup_failed", { error }));
  }, 15 * 60 * 1000);
  timer.unref();
  return timer;
}
