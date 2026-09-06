import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";
import bcrypt from "bcryptjs";

const r = Router();

const revealMethodSchema = z.enum([
  "NORMAL",
  "QR",
  "PIN",
  "LETTER",
  "GIFT",
  "PUZZLE",
]);

const projectInput = z.object({
  templateId: z.string(),
  name: z.string().min(1),

  data: z.record(z.unknown()).default({}),

  customization: z.record(z.unknown()).default({}),

  revealMethod: revealMethodSchema.default("NORMAL"),
});

/* =========================================================
   CREATE PROJECT
   ========================================================= */

r.post("/", auth, async (req, res) => {
  const p = projectInput.safeParse(req.body);

  if (!p.success) {
    return res.status(400).json({
      error: "Invalid project",
    });
  }

  const u = (req as any).user;

  const t = await db.template.findUnique({
    where: {
      id: p.data.templateId,
    },
  });

  if (!t || !t.published) {
    return res.status(404).json({
      error: "Template not found",
    });
  }

  const project = await db.project.create({
    data: {
      userId: u.id,

      templateId: t.id,

      name: p.data.name,

      data: p.data.data as Prisma.InputJsonValue,

      customization: p.data.customization as Prisma.InputJsonValue,

      revealMethod: p.data.revealMethod,
    },
  });

  return res.status(201).json({
    project,
  });
});

/* =========================================================
   UPDATE PROJECT
   ========================================================= */

r.patch("/:id", auth, async (req, res) => {
  const u = (req as any).user;

  const p = projectInput.partial().safeParse(req.body);

  if (!p.success) {
    return res.status(400).json({
      error: "Invalid project",
    });
  }

  const projectId = String(req.params.id);

  const existing = await db.project.findFirst({
    where: {
      id: projectId,
      userId: u.id,
    },
  });

  if (!existing) {
    return res.status(404).json({
      error: "Project not found",
    });
  }

  const project = await db.$transaction(async (tx) => {
    await tx.projectRevision.create({
      data: {
        projectId: existing.id,

        data:
          existing.data === null
            ? Prisma.JsonNull
            : (existing.data as Prisma.InputJsonValue),

        customization:
          existing.customization === null
            ? Prisma.JsonNull
            : (existing.customization as Prisma.InputJsonValue),

        status: existing.status,
      },
    });

    const updateData: Prisma.ProjectUpdateInput = {};

    if (p.data.name !== undefined) {
      updateData.name = p.data.name;
    }

    if (p.data.data !== undefined) {
      updateData.data = p.data.data as Prisma.InputJsonValue;
    }

    if (p.data.customization !== undefined) {
      updateData.customization = p.data.customization as Prisma.InputJsonValue;
    }

    if (p.data.revealMethod !== undefined) {
      updateData.revealMethod = p.data.revealMethod;
    }

    if (p.data.templateId !== undefined) {
      updateData.template = {
        connect: {
          id: p.data.templateId,
        },
      };
    }

    return tx.project.update({
      where: {
        id: existing.id,
      },

      data: updateData,
    });
  });

  return res.json({
    project,
  });
});

/* =========================================================
   GET ALL USER PROJECTS
   ========================================================= */

r.get("/", auth, async (req, res) => {
  const u = (req as any).user;

  const projects = await db.project.findMany({
    where: {
      userId: u.id,
    },
    include: {
      template: true,
      website: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return res.json({
    items: projects,
  });
});

/* =========================================================
   FINALIZE PROJECT
   ========================================================= */
r.post("/:id/finalize", auth, async (req, res) => {
  const u = (req as any).user;

  const project = await db.project.findFirst({
    where: {
      id: String(req.params.id),
      userId: u.id,
    },
  });

  if (!project) {
    return res.status(404).json({
      error: "Project not found",
    });
  }

  const updated = await db.project.update({
    where: {
      id: project.id,
    },
    data: {
      status: "FINALIZED",
    },
  });

  return res.json({
    project: updated,
  });
});

/* =========================================================
   PUBLISH PROJECT
   ========================================================= */

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

r.post("/:id/publish", auth, async (req, res) => {
  const u = (req as any).user;
  const projectId = String(req.params.id);

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      userId: u.id,
    },
    include: {
      website: true,
    },
  });

  if (!project) {
    return res.status(404).json({
      error: "Project not found",
    });
  }

  if (project.status !== "FINALIZED") {
    return res.status(409).json({
      error: "Finalize the project first",
    });
  }

  /*
   * Only a paid project can be published.
   */
  const paidOrder = await db.order.findFirst({
    where: {
      projectId: project.id,
      userId: u.id,
      status: "PAID",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!paidOrder) {
    return res.status(402).json({
      error: "Payment required before publishing",
    });
  }

  const projectData =
    project.data && typeof project.data === "object"
      ? (project.data as Record<string, any>)
      : {};

  const scannerStyle =
    projectData.scannerStyle === "SQUARE" ? "SQUARE" : "HEART";

  /*
   * Already published:
   * keep the same permanent URL.
   */
  if (project.website) {
    const website = await db.publishedSite.update({
      where: {
        id: project.website.id,
      },
      data: {
        status: "ACTIVE",
        revealMethod: project.revealMethod,
      },
    });

    await db.project.update({
      where: {
        id: project.id,
      },
      data: {
        status: "PUBLISHED",
        publishedAt: project.publishedAt || new Date(),
      },
    });

    const appUrl = process.env.APP_URL || "http://localhost:5173";

    return res.json({
      url: `${appUrl}/r/${website.slug}`,

      website,

      packagePrice: paidOrder.amount,

      revealMethod: project.revealMethod,

      scannerStyle: project.revealMethod === "QR" ? scannerStyle : null,
    });
  }

  /*
   * Create a unique permanent slug.
   */
  const baseSlug = makeSlug(project.name) || `surprise-${project.id.slice(-8)}`;

  let slug = baseSlug;
  let counter = 2;

  while (
    await db.publishedSite.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    })
  ) {
    slug = `${baseSlug}-${counter++}`;
  }

  /*
   * Create the permanent website.
   *
   * expiresAt is intentionally left null,
   * so the website does not expire.
   */
  const website = await db.publishedSite.create({
    data: {
      projectId: project.id,

      slug,

      status: "ACTIVE",

      revealMethod: project.revealMethod,
    },
  });

  await db.project.update({
    where: {
      id: project.id,
    },

    data: {
      status: "PUBLISHED",

      publishedAt: new Date(),
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:5173";

  return res.status(201).json({
    url: `${appUrl}/r/${website.slug}`,

    website,

    packagePrice: paidOrder.amount,

    revealMethod: project.revealMethod,

    scannerStyle: project.revealMethod === "QR" ? scannerStyle : null,
  });
});

/* =========================================================
   SAVE REVEAL SETTINGS
   ========================================================= */

r.patch("/:id/reveal", auth, async (req, res) => {
  try {
    const u = (req as any).user;
    const projectId = String(req.params.id);

    const parsed = z
      .object({
        method: revealMethodSchema,

        pin: z.string().optional().default(""),

        puzzleQuestion: z.string().optional().default(""),

        puzzleAnswer: z.string().optional().default(""),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid reveal settings",
      });
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        userId: u.id,
      },
      include: {
        website: true,
      },
    });

    if (!project || !project.website) {
      return res.status(404).json({
        error: "Published website not found",
      });
    }

    /*
     * Update project reveal method.
     */
    await db.project.update({
      where: {
        id: project.id,
      },

      data: {
        revealMethod: parsed.data.method,
      },
    });

    /*
     * Create/update access rule.
     */
    const accessRuleData: any = {
      attempts: 0,
    };

    /* =====================================================
       PIN
       ===================================================== */

    if (parsed.data.method === "PIN") {
      const pin = parsed.data.pin.trim();

      if (!pin || pin.length < 4) {
        return res.status(400).json({
          error: "PIN must contain at least 4 characters",
        });
      }

      accessRuleData.pinHash = await bcrypt.hash(pin, 12);

      accessRuleData.puzzleQuestion = null;
      accessRuleData.puzzleAnswerHash = null;
    }

    /* =====================================================
       PUZZLE
       ===================================================== */

    if (parsed.data.method === "PUZZLE") {
      const puzzleQuestion = parsed.data.puzzleQuestion.trim();
      const puzzleAnswer = parsed.data.puzzleAnswer
        .trim()
        .toLowerCase();

      if (!puzzleQuestion || !puzzleAnswer) {
        return res.status(400).json({
          error: "Puzzle question and answer are required",
        });
      }

      accessRuleData.pinHash = null;

      accessRuleData.puzzleQuestion = puzzleQuestion;

      accessRuleData.puzzleAnswerHash = await bcrypt.hash(
        puzzleAnswer,
        12,
      );
    }

    /* =====================================================
       NORMAL / QR / LETTER / GIFT
       ===================================================== */

    if (
      parsed.data.method === "NORMAL" ||
      parsed.data.method === "QR" ||
      parsed.data.method === "LETTER" ||
      parsed.data.method === "GIFT"
    ) {
      accessRuleData.pinHash = null;
      accessRuleData.puzzleQuestion = null;
      accessRuleData.puzzleAnswerHash = null;
    }

    const accessRule = await db.siteAccessRule.upsert({
      where: {
        siteId: project.website.id,
      },

      update: accessRuleData,

      create: {
        siteId: project.website.id,
        ...accessRuleData,
      },
    });

    const website = await db.publishedSite.update({
      where: {
        id: project.website.id,
      },

      data: {
        revealMethod: parsed.data.method,
      },
    });

    return res.json({
      ok: true,
      website,
      accessRule,
    });
  } catch (error) {
    console.error("Failed to save reveal settings:", error);

    return res.status(500).json({
      error: "Unable to save reveal settings",
    });
  }
});

/* =========================================================
   GET SINGLE PROJECT
   ========================================================= */

r.get("/:id", auth, async (req, res) => {
  const projectId = String(req.params.id);

  const u = (req as any).user;

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      userId: u.id,
    },

    include: {
      template: true,
      website: true,
    },
  });

  if (!project) {
    return res.status(404).json({
      error: "Project not found",
    });
  }

  return res.json({
    project,
  });
});

/* =========================================================
   DELETE DRAFT PROJECT
   ========================================================= */

r.delete("/:id", auth, async (req, res) => {
  try {
    const projectId = String(req.params.id);
    const u = (req as any).user;

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        userId: u.id,
      },
      include: {
        website: true,
        orders: {
          where: {
            status: "PAID",
          },
          take: 1,
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    /*
     * Paid websites can NEVER be deleted.
     */
    if (project.orders.length > 0) {
      return res.status(403).json({
        error: "Paid websites cannot be deleted.",
      });
    }

    /*
     * Only incomplete DRAFT projects can be deleted.
     */
    if (project.status !== "DRAFT" && project.status !== "FINALIZED") {
      return res.status(403).json({
        error: "Only unpaid draft or finalized websites can be deleted.",
      });
    }

    /*
     * A published website should never be deleted.
     * This is an additional safety check.
     */
    if (project.website) {
      return res.status(403).json({
        error: "Published websites cannot be deleted.",
      });
    }

    await db.$transaction(async (tx) => {
  // Delete unpaid orders attached to this project first.
  await tx.order.deleteMany({
    where: {
      projectId: project.id,
      status: {
        not: "PAID",
      },
    },
  });

  // Delete project-related media.
  await tx.projectMedia.deleteMany({
    where: {
      projectId: project.id,
    },
  });

  // Delete project revisions.
  await tx.projectRevision.deleteMany({
    where: {
      projectId: project.id,
    },
  });

  // Finally delete the project.
  await tx.project.delete({
    where: {
      id: project.id,
    },
  });
});

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Delete project failed:", error);

    return res.status(500).json({
      error: "Unable to delete draft",
    });
  }
});

export default r;
