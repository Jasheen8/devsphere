import type { Request, Response, NextFunction } from "express";

export function configuredOrigins() {
  const origins = new Set(["http://localhost:5173", "https://devsphere-s97l.onrender.com"]);
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try { origins.add(new URL(configured).origin); } catch { /* production validation reports invalid URLs */ }
  }
  return origins;
}

export function originProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return next();
  if (req.path.startsWith("/api/payments/webhook")) return next();

  const supplied = req.get("origin");
  const referer = req.get("referer");
  let candidate = supplied;
  if (!candidate && referer) {
    try { candidate = new URL(referer).origin; } catch { candidate = undefined; }
  }
  if (!candidate || !configuredOrigins().has(candidate)) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  return next();
}
