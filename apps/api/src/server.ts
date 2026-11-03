import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { db } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { originProtection, configuredOrigins } from "./lib/csrf.js";
import { createSharedRateLimiter, startRateLimitCleanup } from "./lib/rate-limit.js";
import { createReadinessHandler } from "./lib/readiness.js";
import { validateProductionEnvironment } from "./lib/session-secret.js";
import { validateProductionEmailConfiguration } from "./lib/email.js";
import { releaseGitSha } from "./lib/release-version.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import projectRoutes from "./routes/projects.js";
import mediaRoutes from "./routes/media.js";
import paymentRoutes from "./routes/payments.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import affiliateRoutes from "./routes/affiliate.js";
import affiliateAdminRoutes from "./routes/affiliate-admin.js";
const app = express();
const port = Number(process.env.PORT || 4000);
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigins = [...configuredOrigins()];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(originProtection);
app.use(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "2mb",
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use("/api/auth", createSharedRateLimiter({ scope: "auth", limit: 12, windowMs: 60_000 }));
app.use("/api/affiliate/apply", createSharedRateLimiter({ scope: "affiliate-application", limit: 4, windowMs: 60_000 }));
app.use("/api/affiliate/redirect", createSharedRateLimiter({ scope: "affiliate-referral", limit: 40, windowMs: 60_000 }));
app.use("/api/affiliate", createSharedRateLimiter({ scope: "affiliate-api", limit: 90, windowMs: 60_000 }));
app.use("/api/payments", createSharedRateLimiter({ scope: "payment-sensitive", limit: 90, windowMs: 60_000 }));
app.use("/api/admin", createSharedRateLimiter({ scope: "admin-sensitive", limit: 60, windowMs: 60_000 }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "devsphere-api" })
);
app.get("/version", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ service: "devsphere-api", gitSha: releaseGitSha() });
});
app.get("/ready", createReadinessHandler(() => db.$queryRaw`SELECT 1`));
app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/affiliate", affiliateRoutes);
app.use("/api/admin/affiliate", affiliateAdminRoutes);
app.use("/api/admin", adminRoutes);
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error("http_request_failed", { error: err });
  const missingAffiliateSchema =
    ["P2021", "P2022"].includes(err?.code) &&
    /Affiliate(?:Profile|ProgramPolicy|Offer|ReferralLink|Click|Attribution|Conversion|Commission|LedgerEntry|PaymentAdjustment|PaymentWebhookEvent)/i.test(
      [err?.meta?.table, err?.meta?.modelName, err?.meta?.column]
        .filter(Boolean)
        .join(" "),
    );
  if (missingAffiliateSchema) {
    return res.status(503).json({
      error:
        "Affiliate Hub database tables are not installed. Apply the repository Prisma migrations to this database.",
    });
  }
  res.status(500).json({ error: "Internal server error" });
});
if (process.env.NODE_ENV !== "test") {
  validateProductionEnvironment();
  validateProductionEmailConfiguration();
  if (process.env.NODE_ENV === "production") startRateLimitCleanup();
  app.listen(port, () => logger.info("api_listening", { port }));
}

export { app };
export default app;
