import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db.js";
import { TemplateSchema } from "@memora/shared";

const r = Router();

function slugBase(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "surprise"
  );
}

r.get("/:slug", async (req, res) => {
  const requestedSlug = req.params.slug;
  let site = await db.publishedSite.findUnique({
    where: { slug: requestedSlug },
    select: {
      slug: true,
      projectId: true,
      status: true,
      expiresAt: true,
      revealMethod: true,
      seoTitle: true,
      seoDescription: true,
      ogImageUrl: true,
      project: {
        select: {
          data: true,
          customization: true,
          template: { select: { schema: true } },
        },
      },
      accessRule: {
        select: {
          puzzleQuestion: true,
          letterTitle: true,
          letterIntro: true,
        },
      },
    },
  });

  if (!site) {
    // Recover a paid, finalized project if a previous publishing failure left
    // the payment complete but did not leave its PublishedSite row behind.
    const possibleNames = [
      requestedSlug.replace(/-/g, " "),
      requestedSlug,
    ];
    const candidates = await db.project.findMany({
      where: {
        name: { in: [...new Set(possibleNames)], mode: "insensitive" },
        status: { in: ["FINALIZED", "PUBLISHED"] },
        orders: { some: { status: "PAID" } },
        website: { is: null },
      },
      select: { id: true, name: true, revealMethod: true },
      take: 2,
    });
    const matches = candidates.filter(
      (project) => slugBase(project.name) === requestedSlug,
    );

    if (matches.length === 1) {
      const project = matches[0];
      await db.publishedSite.create({
        data: {
          projectId: project.id,
          slug: requestedSlug,
          status: "ACTIVE",
          revealMethod: project.revealMethod,
          expiresAt: null,
        },
      });
      site = await db.publishedSite.findUnique({
        where: { slug: requestedSlug },
        select: {
          slug: true,
          projectId: true,
          status: true,
          expiresAt: true,
          revealMethod: true,
          seoTitle: true,
          seoDescription: true,
          ogImageUrl: true,
          project: {
            select: {
              data: true,
              customization: true,
              template: { select: { schema: true } },
            },
          },
          accessRule: {
            select: {
              puzzleQuestion: true,
              letterTitle: true,
              letterIntro: true,
            },
          },
        },
      });
    }
  }

  const isExpired =
    site?.status === "EXPIRED" ||
    (site?.status === "ACTIVE" &&
      site.expiresAt !== null &&
      site.expiresAt <= new Date());

  if (site && isExpired) {
    const paidOrder = await db.order.findFirst({
      where: { projectId: site.projectId, status: "PAID" },
      select: { id: true },
    });

    if (paidOrder) {
      site = await db.publishedSite.update({
        where: { slug: site.slug },
        data: { status: "ACTIVE", expiresAt: null },
        select: {
          slug: true,
          projectId: true,
          status: true,
          expiresAt: true,
          revealMethod: true,
          seoTitle: true,
          seoDescription: true,
          ogImageUrl: true,
          project: {
            select: {
              data: true,
              customization: true,
              template: { select: { schema: true } },
            },
          },
          accessRule: {
            select: {
              puzzleQuestion: true,
              letterTitle: true,
              letterIntro: true,
            },
          },
        },
      });
    }
  }

  if (
    !site ||
    site.status !== "ACTIVE" ||
    (site.expiresAt && site.expiresAt < new Date())
  ) {
    return res.status(404).json({ error: "Website not found" });
  }

  const accessRequired =
    site.revealMethod === "PIN" ||
    site.revealMethod === "PUZZLE" ||
    site.revealMethod === "LETTER" ||
    site.revealMethod === "GIFT";

  // Published projects can be edited for a short period after purchase.
  // Always fetch current project data so the same public URL reflects edits.
  res.set("Cache-Control", "no-store");

  const template = TemplateSchema.parse(site.project.template.schema);
  res.json({
    site: {
      slug: site.slug,
      revealMethod: site.revealMethod,
      status: site.status,
      expiresAt: site.expiresAt,
      seoTitle: site.seoTitle,
      seoDescription: site.seoDescription,
      ogImageUrl: site.ogImageUrl,
    },
    template,
    data: site.project.data,
    customization: site.project.customization,
    accessRequired,
    accessRule: site.accessRule
      ? {
          puzzleQuestion: site.accessRule.puzzleQuestion,
          letterTitle: site.accessRule.letterTitle,
          letterIntro: site.accessRule.letterIntro,
        }
      : null,
  });
});

r.post("/:slug/unlock", async (req, res) => {
  const site = await db.publishedSite.findUnique({
    where: { slug: req.params.slug },
    include: { accessRule: true },
  });

  if (!site || site.status !== "ACTIVE" || !site.accessRule) {
    return res.status(404).json({ error: "Website not found" });
  }

  const { pin, answer } = req.body || {};
  let ok = false;

  if (
    site.revealMethod === "PIN" &&
    site.accessRule.pinHash &&
    typeof pin === "string"
  ) {
    ok = await bcrypt.compare(pin.trim(), site.accessRule.pinHash);
  }

  if (
    site.revealMethod === "PUZZLE" &&
    site.accessRule.puzzleAnswerHash &&
    typeof answer === "string"
  ) {
    ok = await bcrypt.compare(
      answer.trim().toLowerCase(),
      site.accessRule.puzzleAnswerHash,
    );
  }

  if (!ok) {
    return res.status(401).json({ error: "That unlock is not correct" });
  }

  res.json({ ok: true });
});

export default r;
