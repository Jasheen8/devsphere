type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|signature|credential|api.?key|payment.?info|card|raw|body|payload)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const DATABASE_URL = /\bpostgres(?:ql)?:\/\/[^\s"']+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const LONG_TOKEN = /\b[A-Fa-f0-9]{40,}\b/g;
const URL_SECRET_PARAMETER = /([?&](?:access_token|api_key|key|password|secret|signature|token|verification_code)=)[^&#\s]+/gi;

export function redactSensitiveData(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value instanceof Error) {
    const safe: Record<string, unknown> = { name: value.name };
    const code = (value as Error & { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9_-]{1,40}$/i.test(code)) safe.code = code;
    return safe;
  }
  if (typeof value === "string") {
    return value
      .replace(DATABASE_URL, "[REDACTED DATABASE URL]")
      .replace(BEARER, "Bearer [REDACTED]")
      .replace(URL_SECRET_PARAMETER, "$1[REDACTED]")
      .replace(EMAIL, "[REDACTED EMAIL]")
      .replace(LONG_TOKEN, "[REDACTED TOKEN]");
  }
  if (Array.isArray(value)) return value.map((item) => redactSensitiveData(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redactSensitiveData(child, childKey)]));
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

function write(level: LogLevel, event: string, details?: unknown) {
  const record = redactSensitiveData({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(details === undefined ? {} : { details }),
  });
  const line = JSON.stringify(record);
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  info(event: string, details?: unknown) { write("info", event, details); },
  warn(event: string, details?: unknown) { write("warn", event, details); },
  error(event: string, details?: unknown) { write("error", event, details); },
};
