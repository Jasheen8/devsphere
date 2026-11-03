import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { auth, requireRole } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { getCurrentAffiliatePolicy, calculatePendingCommissionMinor, isCreatorCommissionWithinPolicy } from "../lib/affiliate.js";
import { affiliateEmails } from "../lib/email.js";

const r = Router();
r.use(auth, requireRole("ADMIN", "SUPER_ADMIN"));

async function uniqueAffiliateSlug() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = `affiliate-${crypto.randomBytes(7).toString("base64url").toLowerCase()}`;
    const [profile, site] = await Promise.all([
      db.affiliateProfile.findUnique({ where: { referralSlug: slug }, select: { id: true } }),
      db.publishedSite.findUnique({ where: { slug }, select: { id: true } }),
    ]);
    if (!profile && !site) return slug;
  }
  throw new Error("Could not generate a unique affiliate slug.");
}

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
  reviewReason: z.string().trim().max(1000).optional().default(""),
});

r.get("/overview", async (_req, res) => {
  const [applications, approved, offers, clicks, conversions, pendingCommission] = await Promise.all([
    db.affiliateProfile.count({ where: { status: "PENDING" } }),
    db.affiliateProfile.count({ where: { status: "APPROVED" } }),
    db.affiliateOffer.count(),
    db.affiliateClick.count(),
    db.affiliateConversion.count(),
    db.affiliateLedgerEntry.groupBy({
      by: ["currency", "type"],
      where: {
        type: { in: ["COMMISSION_PENDING_CREDIT", "COMMISSION_REVERSAL", "COMMISSION_RESTORATION"] },
        commission: { is: { status: "PENDING" } },
      },
      _sum: { amountMinor: true },
    }),
  ]);
  const pendingByCurrency = new Map<string, Array<{ type: string; amountMinor: number }>>();
  for (const row of pendingCommission) {
    const rows = pendingByCurrency.get(row.currency) || [];
    rows.push({ type: row.type, amountMinor: row._sum.amountMinor || 0 });
    pendingByCurrency.set(row.currency, rows);
  }
  res.json({
    applications,
    approved,
    offers,
    clicks,
    conversions,
    pendingCommissionByCurrency: Array.from(pendingByCurrency, ([currency, rows]) => ({
      currency,
      amountMinor: Math.max(0, calculatePendingCommissionMinor(rows)),
    })),
  });
});

r.get("/applications", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const allowed = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: "Invalid application status." });

  const items = await db.affiliateProfile.findMany({
    where: status ? { status: status as any } : {},
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: [{ status: "asc" }, { appliedAt: "desc" }],
  });
  res.json({ items });
});

r.patch("/applications/:id", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose an application status and provide a valid review reason." });
  if (["REJECTED", "SUSPENDED"].includes(parsed.data.status) && !parsed.data.reviewReason) {
    return res.status(400).json({ error: "A review reason is required for this decision." });
  }

  const actor = (req as any).user;
  const current = await db.affiliateProfile.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Affiliate application not found." });

  let referralSlug = current.referralSlug;
  if (parsed.data.status === "APPROVED" && !referralSlug) {
    try {
      referralSlug = await uniqueAffiliateSlug();
    } catch {
      return res.status(503).json({ error: "Could not generate a unique affiliate slug. Please retry." });
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const profile = await tx.affiliateProfile.update({
      where: { id: current.id },
      data: {
        status: parsed.data.status,
        referralSlug,
        reviewedAt: new Date(),
        reviewedById: actor.id,
        reviewReason: parsed.data.reviewReason || null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (parsed.data.status === "SUSPENDED" || parsed.data.status === "REJECTED") {
      await tx.affiliateReferralLink.updateMany({
        where: { affiliateProfileId: current.id },
        data: { active: false },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: `affiliate.application_${parsed.data.status.toLowerCase()}`,
        entity: "AffiliateProfile",
        entityId: current.id,
        metadata: {
          before: { status: current.status, reviewReason: current.reviewReason },
          after: { status: profile.status, reviewReason: profile.reviewReason, referralSlug: profile.referralSlug },
        },
      },
      select: { id: true },
    });
    return profile;
  });

  void affiliateEmails.applicationDecision(updated.user.email, updated.status as "APPROVED" | "REJECTED" | "SUSPENDED", updated.reviewReason);

  res.json({ profile: updated });
});

r.get("/offers", async (_req, res) => {
  const [items, templates, policy] = await Promise.all([
    db.affiliateOffer.findMany({
      include: {
        template: { select: { id: true, slug: true, name: true, price: true, published: true, isFree: true, thumbnailUrl: true } },
        _count: { select: { links: true, conversions: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.template.findMany({
      where: { published: true, isFree: false },
      select: { id: true, slug: true, name: true, price: true },
      orderBy: { name: "asc" },
    }),
    getCurrentAffiliatePolicy(db),
  ]);
  res.json({ items, templates, policy });
});

const offerInput = z.object({
  templateId: z.string().min(1),
  commissionBps: z.number().int().min(0).max(10_000).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ENDED"]).default("ACTIVE"),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

r.post("/offers", async (req, res) => {
  const parsed = offerInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid template, commission rate and offer status." });
  const policy = await getCurrentAffiliatePolicy(db);
  if (!policy) return res.status(503).json({ error: "Affiliate program policy is not initialized." });
  if (parsed.data.commissionBps !== undefined && !isCreatorCommissionWithinPolicy(parsed.data.commissionBps, policy)) {
    return res.status(400).json({ error: "Commission rate is outside the approved creator commission range." });
  }
  const actor = (req as any).user;
  const template = await db.template.findFirst({
    where: { id: parsed.data.templateId, published: true, isFree: false },
    select: { id: true },
  });
  if (!template) return res.status(404).json({ error: "Only published paid templates can have affiliate offers." });

  const startsAt = parsed.data.startsAt || new Date();
  const endsAt = parsed.data.endsAt ?? null;
  if (endsAt && endsAt <= startsAt) return res.status(400).json({ error: "The end date must be after the start date." });

  try {
    const offer = await db.$transaction(async (tx) => {
      const created = await tx.affiliateOffer.create({
        data: {
          templateId: template.id,
          // DevSphere owns all current catalog templates. Client-submitted offer
          // rates never override the policy's approved platform default.
          commissionBps: policy.defaultCommissionBps,
          status: parsed.data.status,
          startsAt,
          endsAt,
          version: 1,
          createdById: actor.id,
        },
        include: { template: { select: { id: true, name: true, slug: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "affiliate.offer_created",
          entity: "AffiliateOffer",
          entityId: created.id,
          metadata: { templateId: template.id, commissionBps: created.commissionBps, status: created.status, version: created.version },
        },
        select: { id: true },
      });
      return created;
    });
    return res.status(201).json({ offer });
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ error: "An affiliate offer already exists for this template. Edit its existing offer." });
    throw error;
  }
});

const offerUpdate = offerInput.omit({ templateId: true }).partial();
r.patch("/offers/:id", async (req, res) => {
  const parsed = offerUpdate.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data || {}).length === 0) {
    return res.status(400).json({ error: "Provide a valid offer update." });
  }
  const actor = (req as any).user;
  const policy = await getCurrentAffiliatePolicy(db);
  if (!policy) return res.status(503).json({ error: "Affiliate program policy is not initialized." });
  if (parsed.data.commissionBps !== undefined && !isCreatorCommissionWithinPolicy(parsed.data.commissionBps, policy)) {
    return res.status(400).json({ error: "Commission rate is outside the approved creator commission range." });
  }
  const current = await db.affiliateOffer.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Affiliate offer not found." });

  const startsAt = parsed.data.startsAt ?? current.startsAt;
  const endsAt = parsed.data.endsAt === undefined ? current.endsAt : parsed.data.endsAt;
  if (endsAt && endsAt <= startsAt) return res.status(400).json({ error: "The end date must be after the start date." });

  const offer = await db.$transaction(async (tx) => {
    const updated = await tx.affiliateOffer.update({
      where: { id: current.id },
      data: {
        commissionBps: policy.defaultCommissionBps,
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.startsAt !== undefined ? { startsAt: parsed.data.startsAt } : {}),
        ...(parsed.data.endsAt !== undefined ? { endsAt: parsed.data.endsAt } : {}),
        version: { increment: 1 },
      },
      include: { template: { select: { id: true, name: true, slug: true } } },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "affiliate.offer_updated",
        entity: "AffiliateOffer",
        entityId: current.id,
        metadata: {
          before: { commissionBps: current.commissionBps, status: current.status, startsAt: current.startsAt.toISOString(), endsAt: current.endsAt?.toISOString() || null, version: current.version },
          after: { commissionBps: updated.commissionBps, status: updated.status, startsAt: updated.startsAt.toISOString(), endsAt: updated.endsAt?.toISOString() || null, version: updated.version },
        },
      },
      select: { id: true },
    });
    return updated;
  });
  res.json({ offer });
});

r.get("/settings", async (_req, res) => {
  const policy = await getCurrentAffiliatePolicy(db);
  if (!policy) return res.status(503).json({ error: "Affiliate program policy is not initialized. Apply the Phase 1 migration." });
  res.json({ policy });
});

const policyUpdate = z.object({
  enabled: z.boolean(),
  defaultCommissionBps: z.number().int().min(0).max(10_000),
  creatorMinCommissionBps: z.number().int().min(0).max(10_000),
  creatorMaxCommissionBps: z.number().int().min(0).max(10_000),
  attributionWindowDays: z.number().int().min(1).max(365),
  termsVersion: z.string().trim().min(1).max(64),
});

r.patch("/settings", async (req, res) => {
  const parsed = policyUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter valid program settings." });
  if (parsed.data.creatorMinCommissionBps > parsed.data.creatorMaxCommissionBps) {
    return res.status(400).json({ error: "The creator minimum cannot exceed the creator maximum." });
  }
  if (!isCreatorCommissionWithinPolicy(parsed.data.defaultCommissionBps, parsed.data)) {
    return res.status(400).json({ error: "The approved default commission must be within the creator commission range." });
  }

  const actor = (req as any).user;
  const current = await getCurrentAffiliatePolicy(db);
  if (!current) return res.status(503).json({ error: "Affiliate program policy is not initialized. Apply the Phase 1 migration." });

  const policy = await db.$transaction(async (tx) => {
    const version = await tx.affiliateProgramPolicy.aggregate({ _max: { version: true } });
    const created = await tx.affiliateProgramPolicy.create({
      data: {
        ...parsed.data,
        version: (version._max.version || 0) + 1,
        effectiveAt: new Date(),
        createdById: actor.id,
      },
    });
    // All catalog offers are DevSphere-owned; keep their versioned rate aligned
    // with the current approved default. Order attributions retain old snapshots.
    await tx.affiliateOffer.updateMany({
      data: { commissionBps: created.defaultCommissionBps, version: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "affiliate.policy_updated",
        entity: "AffiliateProgramPolicy",
        entityId: created.id,
        metadata: {
          before: {
            version: current.version,
            enabled: current.enabled,
            defaultCommissionBps: current.defaultCommissionBps,
            creatorMinCommissionBps: current.creatorMinCommissionBps,
            creatorMaxCommissionBps: current.creatorMaxCommissionBps,
            attributionWindowDays: current.attributionWindowDays,
            termsVersion: current.termsVersion,
          },
          after: {
            version: created.version,
            enabled: created.enabled,
            defaultCommissionBps: created.defaultCommissionBps,
            creatorMinCommissionBps: created.creatorMinCommissionBps,
            creatorMaxCommissionBps: created.creatorMaxCommissionBps,
            attributionWindowDays: created.attributionWindowDays,
            termsVersion: created.termsVersion,
          },
        },
      },
      select: { id: true },
    });
    return created;
  });
  res.json({ policy });
});

export default r;
