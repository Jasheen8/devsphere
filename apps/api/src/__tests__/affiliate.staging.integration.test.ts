import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateStagingRuntimeDatabaseTarget } from "../lib/staging-safety.js";
import { AFFILIATE_ATTRIBUTION_COOKIE, AFFILIATE_VISITOR_COOKIE, calculatePendingCommissionMinor, hashAffiliateVisitor, verifyAffiliateAttribution } from "../lib/affiliate.js";
import { buildAffiliateAttributionSnapshot } from "../lib/affiliate-attribution.js";
import { deleteUnpaidProject } from "../lib/project-deletion.js";
import { processAffiliatePaymentAdjustment } from "../lib/affiliate-payment-events.js";
import { recordVerifiedAffiliateConversion } from "../lib/affiliate.js";
import { incrementSharedRateLimit } from "../lib/rate-limit.js";

const apiDir = process.cwd();
const stageUrl = process.env.AFFILIATE_STAGING_DATABASE_URL || "";
const stageDirectUrl = process.env.AFFILIATE_STAGING_DIRECT_URL || "";
const runtimeUrl = process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL || stageUrl;
const stageRef = process.env.AFFILIATE_STAGING_PROJECT_REF || "";
const confirmation = "I-CONFIRM-THIS-IS-A-SEPARATE-STAGING-PROJECT";

function refFromDatabaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(url.hostname)?.[1] ||
      /(?:^|\.)([a-z0-9]{20})$/i.exec(decodeURIComponent(url.username))?.[1] || null;
  } catch {
    return null;
  }
}

function roleFromDatabaseUrl(rawUrl: string) {
  return decodeURIComponent(new URL(rawUrl).username).split(".")[0];
}

function configuredRefs() {
  const files = [
    `${apiDir}/.env`,
    `${apiDir}/../../.env`,
  ];
  const refs = new Set<string>();
  for (const file of files) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(file));
      for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
        const ref = parsed[key] ? refFromDatabaseUrl(parsed[key]) : null;
        if (ref) refs.add(ref);
      }
    } catch { /* Missing local env files do not grant a staging target. */ }
  }
  return refs;
}

const knownConfiguredRefs = configuredRefs();
const stagingEnabled = Boolean(
  stageUrl && stageDirectUrl &&
  /^[a-z0-9]{20}$/i.test(stageRef) &&
  refFromDatabaseUrl(stageUrl) === stageRef &&
  refFromDatabaseUrl(stageDirectUrl) === stageRef &&
  process.env.AFFILIATE_STAGING_CONFIRM === confirmation &&
  !knownConfiguredRefs.has(stageRef),
);

const runtimeRoleValidated = (() => {
  if (!stagingEnabled || !process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL) return stagingEnabled;
  try {
    validateStagingRuntimeDatabaseTarget({ runtimeUrl, transactionUrl: stageUrl, expectedRef: stageRef });
    return true;
  } catch {
    return false;
  }
})();

const stagingSuite = runtimeRoleValidated ? describe.sequential : describe.skip;
const stagingTest = (name: string, fn: () => Promise<unknown>) => it(name, fn, 60_000);

stagingSuite("Affiliate staging database integration", () => {
  let db: PrismaClient;
  let adminDb: PrismaClient;
  let apiServer: Server;
  let baseUrl = "";
  let sessionSecret = "";
  let appCookieByRole: Record<string, string> = {};
  let category: any;
  let template: any;
  let plan: any;
  let admin: any;
  let affiliateUser: any;
  let buyer: any;
  let profileId = "";
  let offerId = "";
  let linkCode = "";
  let affiliateClickId = "";
  let originalClickCookie = "";
  let paidOrderId = "";
  let paidProjectId = "";
  let paidPaymentId = "";
  let unpaidProjectId = "";
  let unpaidOrderId = "";
  let unpaidAttributionId = "";
  let clickRecordId = "";
  let baselineIds: Record<string, string[]> = {};
  let baselineData: unknown;
  let affiliatePolicyId = "";
  let baselinePendingCommissionByCurrency: Record<string, number> = {};

  async function request(path: string, options: RequestInit = {}, cookie?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        origin: "http://localhost:5173",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(options.headers || {}),
      },
    });
    return response;
  }

  function authCookie(user: any) {
    const token = jwt.sign({ sub: user.id }, sessionSecret, { expiresIn: "10m" });
    return `memora_session=${token}`;
  }

  function mergeSetCookies(cookie: string, response: Response) {
    const jar = new Map<string, string>();
    for (const part of cookie.split(/;\s*/).filter(Boolean)) {
      const index = part.indexOf("=");
      if (index > 0) jar.set(part.slice(0, index), part.slice(index + 1));
    }
    const setCookieHeaders = (response.headers as any).getSetCookie?.() ||
      [response.headers.get("set-cookie")].filter(Boolean);
    for (const header of setCookieHeaders) {
      const first = String(header).split(";", 1)[0];
      const index = first.indexOf("=");
      if (index > 0) jar.set(first.slice(0, index), first.slice(index + 1));
    }
    return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
  }

  function digest(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  async function baselineSnapshot(ids: Record<string, string[]>) {
    const [users, templates, orders, payments, projects] = await Promise.all([
      db.user.findMany({ where: { id: { in: ids.users } }, select: { id: true, role: true, status: true, createdAt: true }, orderBy: { id: "asc" } }),
      db.template.findMany({ where: { id: { in: ids.templates } }, select: { id: true, published: true, price: true }, orderBy: { id: "asc" } }),
      db.order.findMany({ where: { id: { in: ids.orders } }, select: { id: true, status: true, amount: true, currency: true }, orderBy: { id: "asc" } }),
      db.payment.findMany({ where: { id: { in: ids.payments } }, select: { id: true, status: true, amount: true, currency: true }, orderBy: { id: "asc" } }),
      db.project.findMany({ where: { id: { in: ids.projects } }, select: { id: true, status: true, userId: true, templateId: true }, orderBy: { id: "asc" } }),
    ]);
    return { users, templates, orders, payments, projects };
  }

  async function createPaidOrder(name: string, attributedClickId: string) {
    const project = await db.project.create({
      data: {
        userId: buyer.id,
        templateId: template.id,
        name,
        status: "FINALIZED",
        data: {},
        customization: {},
      },
    });
    const order = await db.order.create({
      data: {
        userId: buyer.id,
        projectId: project.id,
        planId: plan.id,
        amount: 10_000,
        currency: "INR",
        provider: "razorpay",
        providerOrderId: `stage-order-${randomBytes(6).toString("hex")}`,
        status: "PENDING",
        affiliateAttribution: {
          create: {
            clickId: attributedClickId,
            affiliateProfileId: profileId,
            referralLinkId: (await db.affiliateReferralLink.findUnique({ where: { code: linkCode } }))!.id,
            offerId,
            commissionBps: 2_000,
            offerVersion: 1,
            policyVersion: 1,
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    return { project, order };
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    sessionSecret = randomBytes(32).toString("hex");
    process.env.SESSION_SECRET = sessionSecret;
    process.env.DATABASE_URL = runtimeUrl;
    process.env.DIRECT_URL = stageDirectUrl;
    db = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
    adminDb = new PrismaClient({ datasources: { db: { url: stageDirectUrl } } });
    await db.$connect();
    await adminDb.$connect();

    const migrations = await adminDb.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE migration_name IN (
        '20261031210000_affiliate_phase1_foundation',
        '20261101090000_affiliate_refund_dispute_hardening',
        '20261101110000_affiliate_default_policy_effective_at',
        '20261102120000_affiliate_phase15_safety'
      ) AND finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(migrations.map((row) => row.migration_name)).toEqual(expect.arrayContaining([
      "20261031210000_affiliate_phase1_foundation",
      "20261101090000_affiliate_refund_dispute_hardening",
      "20261101110000_affiliate_default_policy_effective_at",
      "20261102120000_affiliate_phase15_safety",
    ]));
    const currentPolicy = await db.affiliateProgramPolicy.findFirst({ orderBy: [{ effectiveAt: "desc" }, { version: "desc" }] });
    affiliatePolicyId = currentPolicy!.id;
    // Keep this isolated staging fixture repeatable and leave the program paused.
    // The first migration run already verified the migration's initial value;
    // later runs may encounter the explicit enablement from this suite's admin test.
    if (currentPolicy?.enabled) {
      await adminDb.affiliateProgramPolicy.update({ where: { id: affiliatePolicyId }, data: { enabled: false } });
    }
    const pendingLedgerRows = await db.affiliateLedgerEntry.findMany({
      where: { commission: { is: { status: "PENDING" } }, type: { in: ["COMMISSION_PENDING_CREDIT", "COMMISSION_REVERSAL", "COMMISSION_RESTORATION"] } },
      select: { currency: true, type: true, amountMinor: true },
    });
    const pendingEntriesByCurrency = new Map<string, Array<{ type: string; amountMinor: number }>>();
    for (const row of pendingLedgerRows) {
      const rows = pendingEntriesByCurrency.get(row.currency) || [];
      rows.push({ type: row.type, amountMinor: row.amountMinor });
      pendingEntriesByCurrency.set(row.currency, rows);
    }
    baselinePendingCommissionByCurrency = Object.fromEntries(
      Array.from(pendingEntriesByCurrency, ([currency, rows]) => [currency, calculatePendingCommissionMinor(rows)]),
    );

    const existingIds = await Promise.all([
      db.user.findMany({ select: { id: true } }),
      db.template.findMany({ select: { id: true } }),
      db.order.findMany({ select: { id: true } }),
      db.payment.findMany({ select: { id: true } }),
      db.project.findMany({ select: { id: true } }),
    ]);
    baselineIds = {
      users: existingIds[0].map((row) => row.id),
      templates: existingIds[1].map((row) => row.id),
      orders: existingIds[2].map((row) => row.id),
      payments: existingIds[3].map((row) => row.id),
      projects: existingIds[4].map((row) => row.id),
    };
    baselineData = await baselineSnapshot(baselineIds);

    const { app } = await import("../server.js");
    apiServer = createServer(app);
    await new Promise<void>((resolve, reject) => {
      apiServer.once("error", reject);
      apiServer.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;

    const suffix = randomBytes(5).toString("hex");
    category = await db.category.create({ data: { slug: `affiliate-stage-${suffix}`, name: "Staging Affiliate Fixture" } });
    template = await db.template.create({
      data: {
        slug: `affiliate-stage-template-${suffix}`,
        name: "Affiliate staging template",
        description: "Disposable fixture",
        categoryId: category.id,
        price: 100,
        thumbnailUrl: null,
        tags: [],
        featured: false,
        premium: true,
        isFree: false,
        published: true,
        schema: {},
        defaultData: {},
      },
    });
    plan = await adminDb.pricingPlan.create({
      data: { slug: `affiliate-stage-plan-${suffix}`, name: "Affiliate staging plan", price: 100, currency: "INR", features: {}, limits: {}, active: true },
    });
    [admin, affiliateUser, buyer] = await Promise.all([
      db.user.create({ data: { email: `affiliate-admin-${suffix}@example.invalid`, passwordHash: "stage-only", role: "ADMIN" } }),
      db.user.create({ data: { email: `affiliate-partner-${suffix}@example.invalid`, passwordHash: "stage-only" } }),
      db.user.create({ data: { email: `affiliate-buyer-${suffix}@example.invalid`, passwordHash: "stage-only" } }),
    ]);
    appCookieByRole = { admin: authCookie(admin), affiliate: authCookie(affiliateUser), buyer: authCookie(buyer) };
  }, 60_000);

  afterAll(async () => {
    if (db && affiliatePolicyId) {
      await adminDb.affiliateProgramPolicy.update({ where: { id: affiliatePolicyId }, data: { enabled: false } }).catch(() => undefined);
    }
    if (apiServer?.listening) await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    if (db) await db.$disconnect();
    if (adminDb) await adminDb.$disconnect();
  });

  stagingTest("preserves existing users, templates, orders, payments, and projects before test fixtures are created", async () => {
    expect(digest(baselineData)).toMatch(/^[a-f0-9]{64}$/);
  });

  stagingTest("enforces API authentication independently of database policies", async () => {
    expect((await request("/health")).status).toBe(200);
    const readiness = await request("/ready");
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toMatchObject({ ready: true, database: "ready" });
    expect((await request("/api/affiliate/me")).status).toBe(401);
    expect((await request("/api/admin/affiliate/overview")).status).toBe(401);
    expect((await request("/api/admin/affiliate/overview", {}, appCookieByRole.buyer)).status).toBe(403);
  });

  stagingTest("starts with affiliate enrollment disabled and blocks a valid referral", async () => {
    const policy = await db.affiliateProgramPolicy.findUnique({ where: { id: affiliatePolicyId } });
    expect(policy?.enabled).toBe(false);
    const application = await request("/api/affiliate/apply", {
      method: "POST",
      body: JSON.stringify({ acceptedTermsVersion: policy!.termsVersion }),
    }, appCookieByRole.affiliate);
    expect(application.status).toBe(403);

    const temporaryProfile = await db.affiliateProfile.create({
      data: { userId: affiliateUser.id, status: "APPROVED", acceptedTermsVersion: policy!.termsVersion },
    });
    const temporaryOffer = await db.affiliateOffer.create({
      data: { templateId: template.id, commissionBps: policy!.defaultCommissionBps, status: "ACTIVE", startsAt: new Date(Date.now() - 1000), version: 1, createdById: admin.id },
    });
    const temporaryLink = await db.affiliateReferralLink.create({
      data: { affiliateProfileId: temporaryProfile.id, offerId: temporaryOffer.id, code: `af-${randomBytes(8).toString("hex")}` },
    });
    const referral = await request(`/api/affiliate/redirect/${temporaryLink.code}`, {
      method: "POST",
      body: JSON.stringify({ attributionConsent: true }),
    });
    expect(referral.status).toBe(404);
    expect(await db.affiliateClick.count({ where: { referralLinkId: temporaryLink.id } })).toBe(0);
    await adminDb.affiliateReferralLink.delete({ where: { id: temporaryLink.id } });
    await adminDb.affiliateOffer.delete({ where: { id: temporaryOffer.id } });
    await adminDb.affiliateProfile.delete({ where: { id: temporaryProfile.id } });
  });

  stagingTest("shares rate-limit counters through the staging database", async () => {
    const key = `staging-test-${randomBytes(20).toString("hex")}`;
    const start = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const expiry = new Date(start.getTime() + 120_000);
    expect(await incrementSharedRateLimit(key, start, expiry, db)).toBe(1);
    expect(await incrementSharedRateLimit(key, start, expiry, db)).toBe(2);
    await db.$executeRawUnsafe('DELETE FROM "ApiRateLimitBucket" WHERE "key" = $1', key);
  });

  stagingTest("records an application, applies admin approval, and creates a template offer", async () => {
    await adminDb.affiliateProgramPolicy.update({ where: { id: affiliatePolicyId }, data: { enabled: true } });
    const application = await request("/api/affiliate/apply", {
      method: "POST",
      body: JSON.stringify({ acceptedTermsVersion: "phase1-v1" }),
    }, appCookieByRole.affiliate);
    expect(application.status).toBe(201);
    profileId = (await application.json()).profile.id;

    const decision = await request(`/api/admin/affiliate/applications/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    }, appCookieByRole.admin);
    expect(decision.status).toBe(200);
    expect((await db.affiliateProfile.findUnique({ where: { id: profileId } }))?.status).toBe("APPROVED");

    const offerResponse = await request("/api/admin/affiliate/offers", {
      method: "POST",
      body: JSON.stringify({ templateId: template.id, commissionBps: 9_999, status: "ACTIVE" }),
    }, appCookieByRole.admin);
    expect(offerResponse.status).toBe(400);
    const defaultRateOffer = await request("/api/admin/affiliate/offers", {
      method: "POST",
      body: JSON.stringify({ templateId: template.id, commissionBps: 3_000, status: "ACTIVE" }),
    }, appCookieByRole.admin);
    expect(defaultRateOffer.status).toBe(201);
    expect((await defaultRateOffer.json()).offer.commissionBps).toBe(2_000);
    offerId = (await db.affiliateOffer.findUnique({ where: { templateId: template.id } }))!.id;

    const linkResponse = await request("/api/affiliate/links", {
      method: "POST",
      body: JSON.stringify({ offerId }),
    }, appCookieByRole.affiliate);
    expect(linkResponse.status).toBe(201);
    linkCode = (await linkResponse.json()).link.code;
  });

  stagingTest("records consent, uses the last eligible click, and rejects self-referral and expiry", async () => {
    const clickCount = await db.affiliateClick.count();
    const declined = await request(`/api/affiliate/redirect/${linkCode}`, {
      method: "POST",
      body: JSON.stringify({ attributionConsent: false }),
    });
    expect(declined.status).toBe(200);
    expect((await declined.json()).attributed).toBe(false);
    expect(await db.affiliateClick.count()).toBe(clickCount);

    const first = await request(`/api/affiliate/redirect/${linkCode}`, {
      method: "POST",
      body: JSON.stringify({ attributionConsent: true }),
    });
    expect(first.status).toBe(200);
    let cookie = mergeSetCookies("", first);
    const firstToken = verifyAffiliateAttribution(cookie.split("; ").find((part) => part.startsWith(`${AFFILIATE_ATTRIBUTION_COOKIE}=`))?.split("=").slice(1).join("="));
    expect(firstToken).not.toBeNull();

    const second = await request(`/api/affiliate/redirect/${linkCode}`, {
      method: "POST",
      body: JSON.stringify({ attributionConsent: true }),
    }, cookie);
    cookie = mergeSetCookies(cookie, second);
    const visitorToken = cookie.split("; ").find((part) => part.startsWith(`${AFFILIATE_VISITOR_COOKIE}=`))?.split("=").slice(1).join("=");
    const secondToken = verifyAffiliateAttribution(cookie.split("; ").find((part) => part.startsWith(`${AFFILIATE_ATTRIBUTION_COOKIE}=`))?.split("=").slice(1).join("="));
    expect(secondToken?.clickId).not.toBe(firstToken?.clickId);
    expect(visitorToken).toBeTruthy();
    const visitorHash = hashAffiliateVisitor(String(visitorToken));
    const latestClick = await db.affiliateClick.findUnique({
      where: { id: secondToken!.clickId },
      include: {
        affiliateProfile: { select: { userId: true, status: true } },
        referralLink: {
          include: {
            offer: {
              include: { template: { select: { id: true, published: true, isFree: true } } },
            },
          },
        },
      },
    });
    expect(latestClick?.id).toBe(secondToken?.clickId);
    expect(await db.affiliateClick.count({ where: { visitorTokenHash: visitorHash } })).toBeGreaterThanOrEqual(2);
    affiliateClickId = latestClick!.id;
    originalClickCookie = cookie;

    const policy = await db.affiliateProgramPolicy.findFirst({ orderBy: [{ effectiveAt: "desc" }, { version: "desc" }] });
    expect(buildAffiliateAttributionSnapshot(latestClick, policy, buyer.id, template.id)).not.toBeNull();
    expect(buildAffiliateAttributionSnapshot(latestClick, policy, affiliateUser.id, template.id)).toBeNull();
    expect(buildAffiliateAttributionSnapshot({ ...latestClick, expiresAt: new Date(Date.now() - 1) }, policy, buyer.id, template.id)).toBeNull();
  });

  stagingTest("converts a provider-verified payment once, including concurrent duplicate finalization", async () => {
    const { project, order } = await createPaidOrder("affiliate-stage-paid", affiliateClickId);
    paidProjectId = project.id;
    paidOrderId = order.id;
    const { finalizePaidOrder } = await import("../lib/fulfillment.js");
    const paymentArgs = {
      orderId: order.id,
      userId: buyer.id,
      provider: "razorpay" as const,
      providerPaymentId: `stage-pay-${randomBytes(6).toString("hex")}`,
      signature: "provider-signature-already-verified-at-route",
      providerAmount: 100,
      providerCurrency: "INR" as const,
      raw: { testFixture: true },
    };
    const result = await finalizePaidOrder(paymentArgs);
    expect(result.status).toBe("PAID");
    const duplicateResults = await Promise.all([
      finalizePaidOrder(paymentArgs),
      finalizePaidOrder(paymentArgs),
    ]);
    expect(duplicateResults.every((item) => item.status === "PAID")).toBe(true);

    const payment = await db.payment.findFirst({ where: { providerPaymentId: paymentArgs.providerPaymentId, provider: "razorpay" } });
    paidPaymentId = payment!.id;
    expect(await db.affiliateConversion.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.affiliateCommission.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.affiliateLedgerEntry.count({ where: { commission: { orderId: order.id }, type: "COMMISSION_PENDING_CREDIT" } })).toBe(1);
    expect(payment).toMatchObject({ signature: null, raw: null });
    await expect(deleteUnpaidProject(db, project.id, buyer.id)).rejects.toMatchObject({ statusCode: 403 });

    const expired = await db.order.create({
      data: { userId: buyer.id, projectId: project.id, planId: plan.id, amount: 100, currency: "INR", provider: "razorpay", status: "PENDING" },
    });
    const conversion = await db.$transaction((tx) => recordVerifiedAffiliateConversion(tx, {
      order: {
        id: expired.id,
        amount: expired.amount,
        currency: expired.currency,
        affiliateAttribution: {
          id: "expired-attribution-fixture",
          affiliateProfileId: profileId,
          referralLinkId: ({} as any),
          offerId,
          commissionBps: 2_000,
          offerVersion: 1,
          policyVersion: 1,
          expiresAt: new Date(Date.now() - 1000),
        },
      },
      paymentId: payment!.id,
      verifiedPaymentId: "expired-not-converted",
    }));
    expect(conversion).toBe(false);
    await db.order.delete({ where: { id: expired.id } });
  });

  stagingTest("retries a refund webhook that races payment finalization and applies it once", async () => {
    const { order } = await createPaidOrder("affiliate-stage-refund-race", affiliateClickId);
    const { finalizePaidOrder } = await import("../lib/fulfillment.js");
    const providerPaymentId = `stage-race-pay-${randomBytes(6).toString("hex")}`;
    const event = {
      provider: "razorpay" as const,
      eventId: `race-refund-event-${randomBytes(5).toString("hex")}`,
      eventType: "refund.processed",
      kind: "REFUND" as const,
      externalId: `race-refund-${randomBytes(5).toString("hex")}`,
      providerPaymentId,
      status: "COMPLETED" as const,
      amountMinor: 1_000,
      currency: "INR",
      occurredAt: new Date(),
    };
    const [paid, adjusted] = await Promise.all([
      finalizePaidOrder({
        orderId: order.id,
        userId: buyer.id,
        provider: "razorpay",
        providerPaymentId,
        providerAmount: 100,
        providerCurrency: "INR",
      }),
      processAffiliatePaymentAdjustment(db, event),
    ]);
    expect(paid.status).toBe("PAID");
    expect(adjusted).toMatchObject({ processed: true, duplicate: false });
    const payment = await db.payment.findFirst({ where: { providerPaymentId } });
    expect(payment).not.toBeNull();
    expect(await (db as any).affiliatePaymentAdjustment.count({ where: { paymentId: payment!.id, externalId: event.externalId } })).toBe(1);
    const commission = await db.affiliateCommission.findFirst({ where: { orderId: order.id } });
    expect(commission).toMatchObject({ reversedAmountMinor: 200 });
    expect(await db.affiliateLedgerEntry.count({ where: { commissionId: commission!.id, type: "COMMISSION_REVERSAL" } })).toBe(1);
    const dashboard = await request("/api/affiliate/dashboard", {}, appCookieByRole.affiliate);
    const balances = (await dashboard.json()).balances;
    expect(balances.find((balance: any) => balance.currency === "INR")?.pendingMinor).toBe(3_800);
    const adminOverview = await request("/api/admin/affiliate/overview", {}, appCookieByRole.admin);
    expect((await adminOverview.json()).pendingCommissionByCurrency.find((entry: any) => entry.currency === "INR")?.amountMinor)
      .toBe((baselinePendingCommissionByCurrency.INR || 0) + 3_800);
    // The app role intentionally has INSERT-only access to this idempotency log.
    // Verify its contents through the separate staging test administrator client.
    expect(await adminDb.affiliatePaymentWebhookEvent.count({ where: { provider: "razorpay", eventId: event.eventId } })).toBe(1);
  });

  stagingTest("handles duplicate and concurrent partial refunds, chargebacks, restorations, and full refunds", async () => {
    const occurredAt = new Date();
    const partialRefund = {
      provider: "razorpay" as const,
      eventId: `refund-event-${randomBytes(5).toString("hex")}`,
      eventType: "refund.processed",
      kind: "REFUND" as const,
      externalId: `refund-${randomBytes(5).toString("hex")}`,
      providerPaymentId: `stage-pay-placeholder`,
      status: "COMPLETED" as const,
      amountMinor: 2_000,
      currency: "INR",
      occurredAt,
    };
    const paidPayment = await db.payment.findUnique({ where: { id: paidPaymentId } });
    const input = { ...partialRefund, providerPaymentId: paidPayment!.providerPaymentId! };
    const [partialOne, partialTwo] = await Promise.all([
      processAffiliatePaymentAdjustment(db, input),
      processAffiliatePaymentAdjustment(db, input),
    ]);
    expect([partialOne, partialTwo].filter((item) => item.duplicate).length).toBe(1);
    await Promise.all([
      processAffiliatePaymentAdjustment(db, {
        ...input,
        eventId: `${input.eventId}-provider-redelivery`,
      }),
      processAffiliatePaymentAdjustment(db, {
        ...input,
        eventId: `${input.eventId}-provider-redelivery`,
      }),
    ]);
    let commission = await db.affiliateCommission.findFirst({ where: { orderId: paidOrderId } });
    expect((commission as any)?.reversedAmountMinor).toBe(400);
    expect(await db.affiliatePaymentAdjustment.count({ where: { paymentId: paidPaymentId, kind: "REFUND" } })).toBe(1);
    expect(await db.affiliateLedgerEntry.count({ where: { commissionId: commission!.id, type: "COMMISSION_REVERSAL" } })).toBe(1);

    const disputeId = `dispute-${randomBytes(5).toString("hex")}`;
    await processAffiliatePaymentAdjustment(db, {
      ...input,
      eventId: `dispute-open-${randomBytes(4).toString("hex")}`,
      eventType: "payment.dispute.created",
      kind: "CHARGEBACK",
      externalId: disputeId,
      status: "OPEN",
      amountMinor: 4_000,
      occurredAt: new Date(occurredAt.getTime() + 1000),
    });
    commission = await db.affiliateCommission.findFirst({ where: { orderId: paidOrderId } });
    expect(commission).toMatchObject({ status: "DISPUTED" });
    expect((commission as any)?.reversedAmountMinor).toBe(1_200);

    await processAffiliatePaymentAdjustment(db, {
      ...input,
      eventId: `dispute-won-${randomBytes(4).toString("hex")}`,
      eventType: "payment.dispute.won",
      kind: "CHARGEBACK",
      externalId: disputeId,
      status: "WON",
      amountMinor: 4_000,
      occurredAt: new Date(occurredAt.getTime() + 2000),
    });
    commission = await db.affiliateCommission.findFirst({ where: { orderId: paidOrderId } });
    expect(commission).toMatchObject({ status: "PENDING" });
    expect((commission as any)?.reversedAmountMinor).toBe(400);

    await processAffiliatePaymentAdjustment(db, {
      ...input,
      eventId: `refund-full-${randomBytes(4).toString("hex")}`,
      externalId: `refund-final-${randomBytes(4).toString("hex")}`,
      amountMinor: 8_000,
      occurredAt: new Date(occurredAt.getTime() + 3000),
    });
    expect(await db.payment.findUnique({ where: { id: paidPaymentId } })).toMatchObject({ status: "REFUNDED" });
    expect(await db.order.findUnique({ where: { id: paidOrderId } })).toMatchObject({ status: "REFUNDED" });
    expect(await db.affiliateCommission.findFirst({ where: { orderId: paidOrderId } })).toMatchObject({ status: "REVERSED", reversedAmountMinor: 2_000 });

    await processAffiliatePaymentAdjustment(db, {
      ...input,
      eventId: `dispute-lost-${randomBytes(4).toString("hex")}`,
      eventType: "payment.dispute.lost",
      kind: "CHARGEBACK",
      externalId: `dispute-lost-${randomBytes(4).toString("hex")}`,
      status: "LOST",
      amountMinor: 10_000,
      occurredAt: new Date(occurredAt.getTime() + 4000),
    });
    expect(await (db as any).affiliatePaymentAdjustment.count({ where: { paymentId: paidPaymentId, kind: "CHARGEBACK", status: "LOST" } })).toBe(1);
  });

  stagingTest("keeps commission ledger entries append-only after refund reversals", async () => {
    const commission = await db.affiliateCommission.findFirst({ where: { orderId: paidOrderId } });
    expect(commission).not.toBeNull();
    const entries = await db.affiliateLedgerEntry.findMany({ where: { commissionId: commission!.id }, orderBy: { id: "asc" } });
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.some((entry) => entry.type === "COMMISSION_REVERSAL")).toBe(true);

    const existingLedger = entries.length;
    const ledgerEntry = entries[0];
    await expect(adminDb.affiliateLedgerEntry.update({ where: { id: ledgerEntry.id }, data: { reference: "mutation-attempt" } })).rejects.toThrow(/append-only/i);
    await expect(adminDb.affiliateLedgerEntry.delete({ where: { id: ledgerEntry.id } })).rejects.toThrow(/append-only/i);
    await expect(db.affiliateCommission.update({ where: { id: commission!.id }, data: { status: "AVAILABLE" } })).rejects.toThrow();
    expect(await db.affiliateLedgerEntry.count({ where: { commissionId: commission!.id } })).toBe(existingLedger);
    expect(await db.affiliateLedgerEntry.findMany({ where: { commissionId: commission!.id }, orderBy: { id: "asc" } })).toEqual(entries);
  });

  stagingTest("deletes only an unpaid unconverted order atomically and keeps its click; failure rolls everything back", async () => {
    const project = await db.project.create({ data: { userId: buyer.id, templateId: template.id, name: "affiliate-stage-unpaid", status: "DRAFT", data: {}, customization: {} } });
    const order = await db.order.create({
      data: {
        userId: buyer.id, projectId: project.id, planId: plan.id, amount: 100, currency: "INR", provider: "razorpay", status: "PENDING",
        affiliateAttribution: { create: {
          clickId: affiliateClickId,
          affiliateProfileId: profileId,
          referralLinkId: (await db.affiliateReferralLink.findUnique({ where: { code: linkCode } }))!.id,
          offerId,
          commissionBps: 2_000,
          offerVersion: 1,
          policyVersion: 1,
          expiresAt: new Date(Date.now() + 60_000),
        } },
      },
      include: { affiliateAttribution: true },
    });
    unpaidProjectId = project.id;
    unpaidOrderId = order.id;
    unpaidAttributionId = order.affiliateAttribution!.id;
    clickRecordId = affiliateClickId;

    const failingClient = {
      $transaction: (callback: any, options: any) => db.$transaction(async (tx) => {
        const proxy = new Proxy(tx, {
          get(target, property) {
            const value = Reflect.get(target, property, target);
            if (property === "projectRevision") {
              return new Proxy(value, {
                get(delegate, delegateProperty) {
                  if (delegateProperty === "deleteMany") return async () => { throw new Error("forced rollback probe"); };
                  const method = Reflect.get(delegate, delegateProperty, delegate);
                  return typeof method === "function" ? method.bind(delegate) : method;
                },
              });
            }
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        return callback(proxy);
      }, options),
    };
    await expect(deleteUnpaidProject(failingClient, project.id, buyer.id)).rejects.toThrow("forced rollback probe");
    expect(await db.project.findUnique({ where: { id: project.id } })).not.toBeNull();
    expect(await db.order.findUnique({ where: { id: order.id } })).not.toBeNull();
    expect(await db.affiliateAttribution.findUnique({ where: { id: order.affiliateAttribution!.id } })).not.toBeNull();
    expect(await db.affiliateClick.findUnique({ where: { id: clickRecordId } })).not.toBeNull();

    const deletionResponse = await request(`/api/projects/${project.id}`, { method: "DELETE" }, appCookieByRole.buyer);
    expect(deletionResponse.status).toBe(200);
    expect(await deletionResponse.json()).toEqual({ ok: true });
    expect(await db.project.findUnique({ where: { id: project.id } })).toBeNull();
    expect(await db.order.findUnique({ where: { id: order.id } })).toBeNull();
    expect(await db.affiliateAttribution.findUnique({ where: { id: order.affiliateAttribution!.id } })).toBeNull();
    expect(await db.affiliateClick.findUnique({ where: { id: clickRecordId } })).not.toBeNull();

    const retainedProject = await db.project.create({ data: { userId: buyer.id, templateId: template.id, name: "affiliate-stage-has-payment", status: "DRAFT", data: {}, customization: {} } });
    const retainedOrder = await db.order.create({ data: { userId: buyer.id, projectId: retainedProject.id, planId: plan.id, amount: 100, currency: "INR", provider: "razorpay", status: "PENDING" } });
    await db.payment.create({ data: { id: `staging-failed-payment-${randomBytes(5).toString("hex")}`, orderId: retainedOrder.id, provider: "razorpay", status: "FAILED", amount: 100, currency: "INR" } });
    await expect(deleteUnpaidProject(db, retainedProject.id, buyer.id)).rejects.toThrow(/payment records/i);
    expect(await db.payment.count({ where: { orderId: retainedOrder.id } })).toBe(1);
  });

  stagingTest("retains affiliate history on user/template deletion and archives templates through the existing route", async () => {
    await expect(adminDb.user.delete({ where: { id: affiliateUser.id } })).rejects.toMatchObject({ code: "P2003" });
    await expect(adminDb.template.delete({ where: { id: template.id } })).rejects.toMatchObject({ code: "P2003" });
    await expect(adminDb.affiliateProfile.delete({ where: { id: profileId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(adminDb.affiliateOffer.delete({ where: { id: offerId } })).rejects.toMatchObject({ code: "P2003" });

    const archive = await request(`/api/admin/templates/${template.id}`, { method: "DELETE" }, appCookieByRole.admin);
    expect(archive.status).toBe(204);
    expect(await db.template.findUnique({ where: { id: template.id } })).toMatchObject({ published: false });
    expect(await db.affiliateOffer.findUnique({ where: { id: offerId } })).not.toBeNull();
    expect(await db.affiliateProfile.findUnique({ where: { id: profileId } })).not.toBeNull();
  });

  stagingTest("keeps existing rows byte-for-byte stable and denies Data API roles direct table access", async () => {
    const before = baselineData;
    const currentRole = await db.$queryRaw<Array<{ role: string }>>`SELECT current_user AS role`;
    expect(currentRole[0]?.role).toBe(roleFromDatabaseUrl(runtimeUrl));
    expect(["anon", "authenticated", "service_role"]).not.toContain(currentRole[0]?.role);
    const tableSecurity = await db.$queryRaw<Array<{ relname: string; rls: boolean; anon_access: boolean; authenticated_access: boolean; service_access: boolean }>>`
      SELECT c.relname,
        c.relrowsecurity AS rls,
        (
          has_table_privilege('anon', c.oid, 'SELECT') OR has_table_privilege('anon', c.oid, 'INSERT') OR
          has_table_privilege('anon', c.oid, 'UPDATE') OR has_table_privilege('anon', c.oid, 'DELETE') OR
          has_table_privilege('anon', c.oid, 'TRUNCATE') OR has_table_privilege('anon', c.oid, 'REFERENCES') OR
          has_table_privilege('anon', c.oid, 'TRIGGER') OR has_any_column_privilege('anon', c.oid, 'SELECT') OR
          has_any_column_privilege('anon', c.oid, 'INSERT') OR has_any_column_privilege('anon', c.oid, 'UPDATE') OR
          has_any_column_privilege('anon', c.oid, 'REFERENCES')
        ) AS anon_access,
        (
          has_table_privilege('authenticated', c.oid, 'SELECT') OR has_table_privilege('authenticated', c.oid, 'INSERT') OR
          has_table_privilege('authenticated', c.oid, 'UPDATE') OR has_table_privilege('authenticated', c.oid, 'DELETE') OR
          has_table_privilege('authenticated', c.oid, 'TRUNCATE') OR has_table_privilege('authenticated', c.oid, 'REFERENCES') OR
          has_table_privilege('authenticated', c.oid, 'TRIGGER') OR has_any_column_privilege('authenticated', c.oid, 'SELECT') OR
          has_any_column_privilege('authenticated', c.oid, 'INSERT') OR has_any_column_privilege('authenticated', c.oid, 'UPDATE') OR
          has_any_column_privilege('authenticated', c.oid, 'REFERENCES')
        ) AS authenticated_access,
        (
          has_table_privilege('service_role', c.oid, 'SELECT') OR has_table_privilege('service_role', c.oid, 'INSERT') OR
          has_table_privilege('service_role', c.oid, 'UPDATE') OR has_table_privilege('service_role', c.oid, 'DELETE') OR
          has_table_privilege('service_role', c.oid, 'TRUNCATE') OR has_table_privilege('service_role', c.oid, 'REFERENCES') OR
          has_table_privilege('service_role', c.oid, 'TRIGGER') OR has_any_column_privilege('service_role', c.oid, 'SELECT') OR
          has_any_column_privilege('service_role', c.oid, 'INSERT') OR has_any_column_privilege('service_role', c.oid, 'UPDATE') OR
          has_any_column_privilege('service_role', c.oid, 'REFERENCES')
        ) AS service_access
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN (
        'AffiliateProfile','AffiliateProgramPolicy','AffiliateOffer','AffiliateReferralLink','AffiliateClick',
        'AffiliateAttribution','AffiliateConversion','AffiliateCommission','AffiliateLedgerEntry',
        'AffiliatePaymentAdjustment','AffiliatePaymentWebhookEvent','ApiRateLimitBucket'
      ) ORDER BY c.relname
    `;
    expect(tableSecurity).toHaveLength(12);
    expect(tableSecurity.every((table) => table.rls && !table.anon_access && !table.authenticated_access && !table.service_access)).toBe(true);
    const after = await baselineSnapshot(baselineIds);
    expect(digest(after)).toBe(digest(before));
  });
});
