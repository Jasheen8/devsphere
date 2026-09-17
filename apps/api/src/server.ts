import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import projectRoutes from "./routes/projects.js";
import mediaRoutes from "./routes/media.js";
import paymentRoutes from "./routes/payments.js";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
const app = express();
const port = Number(process.env.PORT || 4000);
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigins = [
  "http://localhost:5173",
  "https://devsphere-s97l.onrender.com",
  process.env.APP_URL,
].filter(Boolean);

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
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "memora-api" }),
);
app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
app.listen(port, () => console.log(`Devsphere API listening on ${port}`));
