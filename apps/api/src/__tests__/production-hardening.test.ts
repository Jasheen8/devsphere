import { afterEach, describe, expect, it, vi } from "vitest";
import { calculatePendingCommissionMinor, eligibleCommissionAmountMinor, isCreatorCommissionWithinPolicy } from "../lib/affiliate.js";
import { originProtection } from "../lib/csrf.js";
import { clearLocalEmailOutbox, configureEmailTransportForTests, getLocalEmailOutbox, sendEmailSafely } from "../lib/email.js";
import { redactSensitiveData } from "../lib/logger.js";
import { createReadinessHandler } from "../lib/readiness.js";
import { createSharedRateLimiter } from "../lib/rate-limit.js";
import { validateProductionSessionSecret } from "../lib/session-secret.js";

afterEach(() => {
  vi.restoreAllMocks();
  configureEmailTransportForTests(undefined);
  clearLocalEmailOutbox();
  delete process.env.SESSION_SECRET;
  process.env.NODE_ENV = "test";
  delete process.env.APP_URL;
});

function responseStub() {
  const result: any = { statusCode: 200, headers: {}, body: undefined };
  result.status = (code: number) => { result.statusCode = code; return result; };
  result.json = (body: unknown) => { result.body = body; return result; };
  result.setHeader = (key: string, value: string) => { result.headers[key] = value; };
  return result;
}

describe("production affiliate hardening", () => {
  it("rejects absent, known development, and weak production session secrets", () => {
    delete process.env.SESSION_SECRET;
    expect(() => validateProductionSessionSecret(undefined)).toThrow(/at least 32 bytes/i);
    expect(() => validateProductionSessionSecret("dev-only-change-me".padEnd(40, "x"))).toThrow(/weak|known development/i);
    expect(() => validateProductionSessionSecret("x".repeat(40))).toThrow(/weak/i);
    expect(validateProductionSessionSecret("s3cure-entropy-" + "q7J9".repeat(10))).toContain("entropy");
  });

  it("enforces the server-side creator commission band", () => {
    const policy = { creatorMinCommissionBps: 1_000, creatorMaxCommissionBps: 4_000 };
    expect(isCreatorCommissionWithinPolicy(1_000, policy)).toBe(true);
    expect(isCreatorCommissionWithinPolicy(4_000, policy)).toBe(true);
    expect(isCreatorCommissionWithinPolicy(999, policy)).toBe(false);
    expect(isCreatorCommissionWithinPolicy(4_001, policy)).toBe(false);
  });

  it("reports pending commission as credits plus restorations and signed refund reversals", () => {
    expect(calculatePendingCommissionMinor([
      { type: "COMMISSION_PENDING_CREDIT", amountMinor: 2_000 },
      { type: "COMMISSION_REVERSAL", amountMinor: -1_250 },
      { type: "COMMISSION_RESTORATION", amountMinor: 500 },
      { type: "PAYOUT_DEBIT", amountMinor: -1_000 },
    ])).toBe(1_250);
  });

  it("keeps the verified integer-minor order total as the single eligible amount basis", () => {
    expect(eligibleCommissionAmountMinor({ amount: 10_001 })).toBe(10_001);
    expect(() => eligibleCommissionAmountMinor({ amount: 0 })).toThrow(/eligible order amount/i);
    expect(() => eligibleCommissionAmountMinor({ amount: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/eligible order amount/i);
  });

  it("blocks missing and foreign origins for mutations but allows configured origins and provider webhooks", async () => {
    const invoke = async (request: any) => {
      const response = responseStub();
      let passed = false;
      originProtection(request, response, () => { passed = true; });
      return { response, passed };
    };
    const makeReq = (method: string, path: string, headers: Record<string, string> = {}) => ({ method, path, get: (key: string) => headers[key.toLowerCase()] });
    expect((await invoke(makeReq("POST", "/api/affiliate/apply"))).response.statusCode).toBe(403);
    expect((await invoke(makeReq("POST", "/api/affiliate/apply", { origin: "https://evil.example" }))).response.statusCode).toBe(403);
    expect((await invoke(makeReq("POST", "/api/affiliate/apply", { origin: "http://localhost:5173" }))).passed).toBe(true);
    expect((await invoke(makeReq("POST", "/api/payments/webhook/razorpay"))).passed).toBe(true);
    expect((await invoke(makeReq("GET", "/api/affiliate/me"))).passed).toBe(true);
  });

  it("shares rate counters across middleware instances and keys only opaque hashes", async () => {
    const records = new Map<string, number>();
    const increment = async (key: string) => {
      records.set(key, (records.get(key) || 0) + 1);
      return records.get(key)!;
    };
    const one = createSharedRateLimiter({ scope: "auth", limit: 2, windowMs: 60_000, increment });
    const two = createSharedRateLimiter({ scope: "auth", limit: 2, windowMs: 60_000, increment });
    const invoke = async (middleware: any) => {
      const response = responseStub();
      let passed = false;
      await middleware({ ip: "203.0.113.25", socket: {} }, response, () => { passed = true; });
      return { response, passed };
    };
    expect((await invoke(one)).passed).toBe(true);
    expect((await invoke(two)).passed).toBe(true);
    expect((await invoke(one)).response.statusCode).toBe(429);
    expect([...records.keys()].every((key) => !key.includes("203.0.113.25"))).toBe(true);
  });

  it("keeps local mail testable and reports provider failure without failing silently", async () => {
    const localSend = await sendEmailSafely("person@example.test", "Reset", "token-secret-value");
    expect(localSend).toBe(true);
    expect(getLocalEmailOutbox()).toHaveLength(1);
    configureEmailTransportForTests({ send: async () => { throw new Error("provider token-secret-value failed for person@example.test"); } });
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await expect(sendEmailSafely("person@example.test", "Reset", "token-secret-value")).resolves.toBe(false);
    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(output).not.toContain("token-secret-value");
    expect(output).not.toContain("person@example.test");
  });

  it("redacts credentials, tokens, payment data and email addresses from structured logs", () => {
    const safe = JSON.stringify(redactSensitiveData({
      password: "sensitive-password",
      resetToken: "sensitive-reset-token",
      authorization: "Bearer sensitive-key",
      paymentInfo: { cardNumber: "4111111111111111" },
      note: "postgresql://user:secret@db.example/postgres and https://example.test/path?token=secret-value and user@example.com",
    }));
    for (const secret of ["sensitive-password", "sensitive-reset-token", "sensitive-key", "4111111111111111", "user@example.com", "postgresql://user:secret", "token=secret-value"]) {
      expect(safe).not.toContain(secret);
    }
  });

  it("reports readiness only when the database probe succeeds", async () => {
    const invoke = async (handler: any) => {
      const response = responseStub();
      await handler({}, response);
      return response;
    };
    expect(await invoke(createReadinessHandler(async () => 1))).toMatchObject({ statusCode: 200, body: { ready: true, database: "ready" } });
    expect(await invoke(createReadinessHandler(async () => { throw new Error("offline"); }))).toMatchObject({ statusCode: 503, body: { ready: false, database: "unavailable" } });
  });
});
