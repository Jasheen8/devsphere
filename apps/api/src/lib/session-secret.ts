import crypto from "node:crypto";

const KNOWN_DEVELOPMENT_SECRET = "dev-only-change-me";
let ephemeralLocalSecret: string | undefined;

export function validateProductionSessionSecret(value = process.env.SESSION_SECRET) {
  if (!value || value === KNOWN_DEVELOPMENT_SECRET || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("Production requires SESSION_SECRET with at least 32 bytes of high-entropy value.");
  }
  if (/^(.)\1{31,}$/.test(value) || /^(password|secret|changeme|development|dev-only)/i.test(value)) {
    throw new Error("Production SESSION_SECRET is weak or a known development value.");
  }
  return value;
}

export function getSessionSecret() {
  if (process.env.NODE_ENV === "production") return validateProductionSessionSecret();
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  ephemeralLocalSecret ||= crypto.randomBytes(48).toString("base64url");
  return ephemeralLocalSecret;
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  validateProductionSessionSecret();
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl || new URL(appUrl).protocol !== "https:") {
    throw new Error("Production requires APP_URL to be an HTTPS origin for CSRF and cookie validation.");
  }
}
