import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import {
  AFFILIATE_ATTRIBUTION_COOKIE,
  AFFILIATE_VISITOR_COOKIE,
  createAffiliateCode,
  getCurrentAffiliatePolicy,
  hashAffiliateVisitor,
  signAffiliateAttribution,
} from "../lib/affiliate.js";
import { sendEmailSafely } from "../lib/email.js";

const r = Router();
const applySchema = z.object({ acceptedTermsVersion: z.string().min(1).max(64) });

function cookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    maxAge,
    path: "/",
  };
}

function configuredAppUrl(path: string) {
  const base = process.env.APP_URL?.trim() || "http://localhost:5173";
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

r.post("/redirect/:code", async (req, res) => {
  const consent = z.object({ attributionConsent: z.boolean() }).safeParse(req.body);
  if (!consent.success) return res.status(400).json({ error: "Choose whether to continue with affiliate attribution." });

  const code = String(req.params.code || "").toLowerCase();
  const now = new Date();
  const [link, policy] = await Promise.all([
    db.affiliateReferralLink.findUnique({
      where: { code },
      include: {
        affiliateProfile: { select: { id: true, userId: true, status: true } },
        offer: { include: { template: { select: { id: true, slug: true, published: true, isFree: true } } } },
      },
    }),
    getCurrentAffiliatePolicy(db, now),
  ]);

  if (
    !link ||
    !policy?.enabled ||
    !link.active ||
    link.affiliateProfile.status !== "APPROVED" ||
    link.offer.status !== "ACTIVE" ||
    link.offer.startsAt > now ||
    (link.offer.endsAt && link.offer.endsAt <= now) ||
    !link.offer.template.published ||
    link.offer.template.isFree
  ) {
    return res.status(404).json({ error: "Affiliate link is unavailable." });
  }

  let attributionExpiresAt: Date | null = null;
  if (consent.data.attributionConsent) {
    let visitorToken = req.cookies?.[AFFILIATE_VISITOR_COOKIE];
    if (typeof visitorToken !== "string" || !/^[a-f0-9]{48}$/.test(visitorToken)) {
      visitorToken = crypto.randomBytes(24).toString("hex");
    }

    attributionExpiresAt = new Date(now.getTime() + policy.attributionWindowDays * 24 * 60 * 60 * 1000);
    res.cookie(
      AFFILIATE_VISITOR_COOKIE,
      visitorToken,
      cookieOptions(policy.attributionWindowDays * 24 * 60 * 60 * 1000),
    );
    const click = await db.affiliateClick.create({
      data: {
        referralLinkId: link.id,
        affiliateProfileId: link.affiliateProfileId,
        visitorTokenHash: hashAffiliateVisitor(visitorToken),
        clickedAt: now,
        expiresAt: attributionExpiresAt,
      },
    });

    res.cookie(
      AFFILIATE_ATTRIBUTION_COOKIE,
      signAffiliateAttribution({ clickId: click.id, expiresAt: attributionExpiresAt.getTime() }),
      cookieOptions(policy.attributionWindowDays * 24 * 60 * 60 * 1000),
    );
  } else {
    const cookieAttributes = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
      path: "/",
    };
    res.clearCookie(AFFILIATE_ATTRIBUTION_COOKIE, cookieAttributes);
    res.clearCookie(AFFILIATE_VISITOR_COOKIE, cookieAttributes);
  }

  return res.json({
    redirectUrl: configuredAppUrl(`/templates/${encodeURIComponent(link.offer.template.id)}`),
    attributed: consent.data.attributionConsent,
    attributionExpiresAt: attributionExpiresAt?.toISOString() || null,
  });
});

r.post("/apply", auth, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Accept the current affiliate program terms to apply." });

  const user = (req as any).user;
  const policy = await getCurrentAffiliatePolicy(db);
  if (!policy?.enabled) return res.status(403).json({ error: "The affiliate program is not accepting applications." });
  if (parsed.data.acceptedTermsVersion !== policy.termsVersion) {
    return res.status(409).json({ error: "The affiliate program terms changed. Review and accept the current version." });
  }

  const current = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  if (current && current.status !== "REJECTED") {
    return res.status(409).json({ error: `Your affiliate application is already ${current.status.toLowerCase()}.` });
  }

  const profile = current
    ? await db.affiliateProfile.update({
        where: { id: current.id },
        data: {
          status: "PENDING",
          acceptedTermsVersion: policy.termsVersion,
          appliedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          reviewReason: null,
        },
      })
    : await db.affiliateProfile.create({
        data: {
          userId: user.id,
          status: "PENDING",
          acceptedTermsVersion: policy.termsVersion,
        },
      });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: current ? "affiliate.application_resubmitted" : "affiliate.application_submitted",
      entity: "AffiliateProfile",
      entityId: profile.id,
      metadata: { termsVersion: policy.termsVersion },
    },
    select: { id: true },
  });

  void sendEmailSafely(user.email, "Affiliate application received", "We received your DevSphere Affiliate Hub application. We will email you after it has been reviewed.");
  if (process.env.ADMIN_EMAIL?.trim()) {
    void sendEmailSafely(process.env.ADMIN_EMAIL.trim(), "Affiliate application needs review", "A new DevSphere Affiliate Hub application is ready for administrator review.");
  }

  return res.status(201).json({ profile });
});

r.get("/me", auth, async (req, res) => {
  const user = (req as any).user;
  const [profile, policy] = await Promise.all([
    db.affiliateProfile.findUnique({ where: { userId: user.id } }),
    getCurrentAffiliatePolicy(db),
  ]);
  res.json({
    profile,
    policy: policy
      ? {
          enabled: policy.enabled,
          version: policy.version,
          defaultCommissionBps: policy.defaultCommissionBps,
          attributionWindowDays: policy.attributionWindowDays,
          termsVersion: policy.termsVersion,
        }
      : null,
  });
});

r.get("/products", auth, async (req, res) => {
  const user = (req as any).user;
  const [profile, policy] = await Promise.all([
    db.affiliateProfile.findUnique({ where: { userId: user.id } }),
    getCurrentAffiliatePolicy(db),
  ]);
  if (profile?.status !== "APPROVED") return res.status(403).json({ error: "Affiliate approval is required." });
  if (!policy?.enabled) return res.json({ items: [] });

  const now = new Date();
  const items = await db.affiliateOffer.findMany({
    where: {
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      template: { published: true, isFree: false },
    },
    include: {
      template: { select: { id: true, slug: true, name: true, description: true, price: true, thumbnailUrl: true } },
      links: { where: { affiliateProfileId: profile.id, active: true }, select: { id: true, code: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

r.post("/links", auth, async (req, res) => {
  const parsed = z.object({ offerId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose an active offer." });

  const user = (req as any).user;
  const profile = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  if (profile?.status !== "APPROVED") return res.status(403).json({ error: "Affiliate approval is required." });

  const now = new Date();
  const [policy, offer] = await Promise.all([
    getCurrentAffiliatePolicy(db, now),
    db.affiliateOffer.findUnique({
      where: { id: parsed.data.offerId },
      include: { template: { select: { id: true, published: true, isFree: true } } },
    }),
  ]);
  if (!policy?.enabled) return res.status(403).json({ error: "The affiliate program is paused." });
  if (
    !offer ||
    offer.status !== "ACTIVE" ||
    offer.startsAt > now ||
    (offer.endsAt && offer.endsAt <= now) ||
    !offer.template.published ||
    offer.template.isFree
  ) {
    return res.status(404).json({ error: "This offer is no longer available." });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createAffiliateCode();
    const collidesWithSite = await db.publishedSite.findUnique({ where: { slug: code }, select: { id: true } });
    if (collidesWithSite) continue;
    try {
      const link = await db.affiliateReferralLink.create({
        data: { affiliateProfileId: profile.id, offerId: offer.id, code },
        include: { offer: { include: { template: { select: { id: true, name: true, slug: true } } } } },
      });
      return res.status(201).json({ link, url: configuredAppUrl(`/r/${code}`) });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }
  return res.status(503).json({ error: "Could not generate a unique referral code. Please try again." });
});

r.get("/links", auth, async (req, res) => {
  const user = (req as any).user;
  const profile = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return res.json({ items: [] });
  const items = await db.affiliateReferralLink.findMany({
    where: { affiliateProfileId: profile.id },
    include: {
      offer: { include: { template: { select: { id: true, name: true, slug: true } } } },
      _count: { select: { clicks: true, conversions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

r.get("/dashboard", auth, async (req, res) => {
  const user = (req as any).user;
  const profile = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return res.status(404).json({ error: "Apply to the affiliate program to open your dashboard." });

  const [clicks, uniqueVisitorRows, conversions, ledger, recentCommissions] = await Promise.all([
    db.affiliateClick.count({ where: { affiliateProfileId: profile.id } }),
    db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT "visitorTokenHash")::int AS count
      FROM "AffiliateClick"
      WHERE "affiliateProfileId" = ${profile.id}
    `,
    db.affiliateConversion.count({ where: { affiliateProfileId: profile.id } }),
    db.affiliateLedgerEntry.groupBy({
      by: ["currency", "type"],
      where: { affiliateProfileId: profile.id },
      _sum: { amountMinor: true },
    }),
    db.affiliateCommission.findMany({
      where: { affiliateProfileId: profile.id },
      include: { order: { select: { project: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const currencyTotals = new Map<string, { pendingMinor: number; availableMinor: number; reservedMinor: number; paidMinor: number; lifetimeMinor: number }>();
  for (const row of ledger) {
    const totals = currencyTotals.get(row.currency) || { pendingMinor: 0, availableMinor: 0, reservedMinor: 0, paidMinor: 0, lifetimeMinor: 0 };
    const amount = row._sum.amountMinor || 0;
    totals.lifetimeMinor += amount;
    if (row.type === "COMMISSION_PENDING_CREDIT" || row.type === "COMMISSION_REVERSAL" || row.type === "COMMISSION_RESTORATION") totals.pendingMinor += amount;
    if (row.type === "PAYOUT_RESERVATION") totals.reservedMinor += amount;
    if (row.type === "PAYOUT_DEBIT") totals.paidMinor += Math.abs(amount);
    currencyTotals.set(row.currency, totals);
  }

  res.json({
    profile,
    metrics: {
      clicks,
      uniqueVisitors: Number(uniqueVisitorRows[0]?.count || 0),
      conversions,
      conversionRate: clicks > 0 ? conversions / clicks : 0,
    },
    balances: Array.from(currencyTotals, ([currency, amounts]) => ({ currency, ...amounts })),
    recentCommissions,
  });
});

r.get("/commissions", auth, async (req, res) => {
  const user = (req as any).user;
  const profile = await db.affiliateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return res.json({ items: [] });
  const items = await db.affiliateCommission.findMany({
    where: { affiliateProfileId: profile.id },
    include: {
      order: { select: { id: true, currency: true, createdAt: true, project: { select: { name: true } } } },
      conversion: { select: { convertedAt: true, verifiedPaymentId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items });
});

export default r;
