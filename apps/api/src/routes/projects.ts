import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";
import { TemplateSchema } from "@memora/shared";
import { publishPaidProject } from "../lib/fulfillment.js";

const r = Router();

r.use(auth);

const revealMethodSchema = z.enum([
  "NORMAL",
  "QR",
  "PIN",
  "LETTER",
  "GIFT",
  "PUZZLE",
]);

const SPECIAL_REVEAL_METHODS = [
  "QR",
  "PIN",
  "LETTER",
  "GIFT",
  "PUZZLE",
] as const;

const projectInput = z.object({
  templateId: z.string(),
  name: z.string().min(1).max(160),
  data: z.record(z.unknown()).default({}),
  customization: z.record(z.unknown()).default({}),
  revealMethod: revealMethodSchema.default("NORMAL"),
});

/* =========================================================
   CREATE PROJECT
   ========================================================= */

r.post("/", async (req, res) => {
  try {
    const parsed = projectInput.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid project",
      });
    }

    const u = (req as any).user;

    const template = await db.template.findUnique({
      where: {
        id: parsed.data.templateId,
      },
    });

    if (!template || !template.published) {
      return res.status(404).json({
        error: "Template not found",
      });
    }

    const project = await db.project.create({
      data: {
        userId: u.id,
        templateId: template.id,
        name: parsed.data.name,
        data: parsed.data.data as Prisma.InputJsonValue,
        customization:
          parsed.data.customization as Prisma.InputJsonValue,
        revealMethod: parsed.data.revealMethod,
      },
    });

    return res.status(201).json({
      project,
    });
  } catch (error) {
    console.error("Create project failed:", error);

    return res.status(500).json({
      error: "Unable to create project",
    });
  }
});

/* =========================================================
   GET ALL USER PROJECTS
   ========================================================= */

r.get("/", async (req, res) => {
  try {
    const u = (req as any).user;

    const projects = await db.project.findMany({
      where: {
        userId: u.id,
      },
      include: {
        template: true,
        website: true,
        orders: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.json({
      items: projects,
    });
  } catch (error) {
    console.error("Get projects failed:", error);

    return res.status(500).json({
      error: "Unable to load projects",
    });
  }
});

/* =========================================================
   GET SINGLE PROJECT
   ========================================================= */

r.get("/:id", async (req, res) => {
  try {
    const u = (req as any).user;

    const project = await db.project.findFirst({
      where: {
        id: String(req.params.id),
        userId: u.id,
      },
      include: {
        template: true,
        media: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        website: true,
        orders: true,
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
  } catch (error) {
    console.error("Get project failed:", error);

    return res.status(500).json({
      error: "Unable to load project",
    });
  }
});

/* =========================================================
   UPDATE PROJECT
   ========================================================= */

r.patch("/:id", async (req, res) => {
  try {
    const u = (req as any).user;

    const parsed = projectInput
      .partial()
      .safeParse(req.body);

    if (!parsed.success) {
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

    /*
     * A published project should not be edited through the
     * normal project editor. Reveal settings have their own route.
     */
    if (existing.status === "PUBLISHED") {
      return res.status(409).json({
        error: "Published websites cannot be edited here.",
      });
    }

    const updateData: Prisma.ProjectUpdateInput = {};

    if (parsed.data.templateId !== undefined) {
      const template = await db.template.findFirst({
        where: {
          id: parsed.data.templateId,
          published: true,
        },
      });

      if (!template) {
        return res.status(404).json({
          error: "Template not found",
        });
      }

      updateData.template = {
        connect: {
          id: template.id,
        },
      };
    }

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }

    if (parsed.data.data !== undefined) {
      updateData.data =
        parsed.data.data as Prisma.InputJsonValue;
    }

    if (parsed.data.customization !== undefined) {
      updateData.customization =
        parsed.data.customization as Prisma.InputJsonValue;
    }

    if (parsed.data.revealMethod !== undefined) {
      updateData.revealMethod =
        parsed.data.revealMethod;
    }

    /*
     * Nothing changed.
     */
    if (Object.keys(updateData).length === 0) {
      return res.json({
        project: existing,
      });
    }

    const project = await db.$transaction(
      async (tx) => {
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

        return tx.project.update({
          where: {
            id: existing.id,
          },
          data: updateData,
        });
      },
    );

    return res.json({
      project,
    });
  } catch (error) {
    console.error("Update project failed:", error);

    return res.status(500).json({
      error: "Unable to update project",
    });
  }
});

/* =========================================================
   FINALIZE PROJECT
   ========================================================= */

r.post("/:id/finalize", async (req, res) => {
  try {
    const u = (req as any).user;

    const project = await db.project.findFirst({
      where: {
        id: String(req.params.id),
        userId: u.id,
      },
      include: {
        template: true,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found",
      });
    }

    if (project.status !== "DRAFT") {
      if (project.status === "FINALIZED") {
        return res.json({
          project,
        });
      }

      return res.status(409).json({
        error: "Project cannot be finalized in its current state",
      });
    }

    let schema: any;

    try {
      schema = TemplateSchema.parse(
        project.template.schema,
      );
    } catch (error) {
      console.error(
        "Invalid template schema:",
        error,
      );

      return res.status(500).json({
        error: "Template configuration is invalid",
      });
    }

    const missing = schema.fields
      .filter(
        (field: any) =>
          field.required &&
          (
            project.data as any
          )?.[field.id] === undefined ||
          (
            field.required &&
            String(
              (project.data as any)?.[field.id] ?? "",
            ).trim() === ""
          ),
      )
      .map((field: any) => field.label);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Please complete: ${missing.join(", ")}`,
      });
    }

    const updatedProject =
      await db.project.update({
        where: {
          id: project.id,
        },
        data: {
          status: "FINALIZED",
          finalizedAt: new Date(),
        },
      });

    return res.json({
      project: updatedProject,
    });
  } catch (error) {
    console.error("Finalize project failed:", error);

    return res.status(500).json({
      error: "Unable to finalize project",
    });
  }
});

/* =========================================================
   PUBLISH PROJECT
   ========================================================= */

r.post("/:id/publish", async (req, res) => {
  const u = (req as any).user;

  try {
    const result = await publishPaidProject(
      String(req.params.id),
      u.id,
    );

    return res.json(result);
  } catch (error: any) {
    const message =
      error?.message ||
      "Unable to publish website";

    const status =
      message === "Project not found"
        ? 404
        : message === "Payment required"
          ? 402
          : message.includes("finalized")
            ? 409
            : 500;

    return res.status(status).json({
      error: message,
    });
  }
});

/* =========================================================
   SAVE REVEAL SETTINGS
   ========================================================= */

r.patch("/:id/reveal", async (req, res) => {
  try {
    const u = (req as any).user;

    const projectId = String(req.params.id);

    const parsed = z
      .object({
        method: revealMethodSchema,

        pin: z
          .string()
          .min(4)
          .max(64)
          .optional(),

        puzzleQuestion: z
          .string()
          .max(240)
          .optional(),

        puzzleAnswer: z
          .string()
          .max(240)
          .optional(),

        letterTitle: z
          .string()
          .max(160)
          .optional(),

        letterIntro: z
          .string()
          .max(500)
          .optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid reveal settings",
      });
    }

    const data = parsed.data;

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

    /*
     * Reveal configuration is intended for a published website.
     */
    if (!project.website) {
      return res.status(409).json({
        error:
          "Publish the website before configuring its reveal",
      });
    }

    /*
     * Special reveal methods are part of the paid package.
     *
     * INR:
     *   Basic          = ₹99
     *   Movie          = ₹109
     *   Special Reveal = ₹119
     *
     * USD:
     *   Basic          = $1.99
     *   Movie          = $2.49
     *   Special Reveal = $2.99
     */
    if (
      SPECIAL_REVEAL_METHODS.includes(
        data.method as
          (typeof SPECIAL_REVEAL_METHODS)[number],
      )
    ) {
      const paidOrder =
        await db.order.findFirst({
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
          error:
            "Payment is required for this reveal method.",
        });
      }

      const requiredAmount =
  paidOrder.currency === "USD"
    ? 1000
    : 11900;

      if (paidOrder.amount < requiredAmount) {
        return res.status(403).json({
          error:
            "This reveal method is not included in your purchased package.",
        });
      }
    }

    /*
     * Validate method-specific data BEFORE changing the DB.
     */
    if (
      data.method === "PIN" &&
      !data.pin
    ) {
      return res.status(400).json({
        error: "PIN is required",
      });
    }

    if (
      data.method === "PUZZLE" &&
      (
        !data.puzzleQuestion?.trim() ||
        !data.puzzleAnswer?.trim()
      )
    ) {
      return res.status(400).json({
        error:
          "Puzzle question and answer are required",
      });
    }

    const result =
      await db.$transaction(async (tx) => {
        await tx.project.update({
          where: {
            id: project.id,
          },
          data: {
            revealMethod: data.method,
          },
        });

        await tx.publishedSite.update({
          where: {
            id: project.website!.id,
          },
          data: {
            revealMethod: data.method,
          },
        });

        /*
         * Always clear previous access settings first.
         *
         * This prevents:
         * PIN → NORMAL
         * PUZZLE → NORMAL
         * PIN → PUZZLE
         *
         * from leaving stale credentials behind.
         */
        const accessRuleData = {
          pinHash: null as string | null,
          puzzleQuestion: null as string | null,
          puzzleAnswerHash:
            null as string | null,
          letterTitle: null as string | null,
          letterIntro: null as string | null,
          attempts: 0,
        };

        if (data.method === "PIN") {
          accessRuleData.pinHash =
            await bcrypt.hash(
              data.pin!,
              12,
            );
        }

        if (data.method === "PUZZLE") {
          accessRuleData.puzzleQuestion =
            data.puzzleQuestion!.trim();

          accessRuleData.puzzleAnswerHash =
            await bcrypt.hash(
              data.puzzleAnswer!
                .trim()
                .toLowerCase(),
              12,
            );
        }

        if (data.method === "LETTER") {
          accessRuleData.letterTitle =
            data.letterTitle?.trim() || null;

          accessRuleData.letterIntro =
            data.letterIntro?.trim() || null;
        }

        return tx.siteAccessRule.upsert({
          where: {
            siteId: project.website!.id,
          },
          update: accessRuleData,
          create: {
            siteId: project.website!.id,
            ...accessRuleData,
          },
        });
      });

    return res.json({
      ok: true,
      accessRule: result,
    });
  } catch (error) {
    console.error(
      "Failed to save reveal settings:",
      error,
    );

    return res.status(500).json({
      error: "Unable to save reveal settings",
    });
  }
});

/* =========================================================
   DELETE UNPAID DRAFT / FINALIZED PROJECT
   ========================================================= */

r.delete("/:id", async (req, res) => {
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
     * NEVER allow a paid project to be deleted.
     */
    if (project.orders.length > 0) {
      return res.status(403).json({
        error:
          "Paid websites cannot be deleted.",
      });
    }

    /*
     * Published projects should never be deleted.
     */
    if (project.website) {
      return res.status(403).json({
        error:
          "Published websites cannot be deleted.",
      });
    }

    /*
     * Only unpaid draft/finalized projects can be deleted.
     */
    if (
      project.status !== "DRAFT" &&
      project.status !== "FINALIZED"
    ) {
      return res.status(403).json({
        error:
          "Only unpaid draft or finalized websites can be deleted.",
      });
    }

    await db.$transaction(async (tx) => {
      /*
       * Delete unpaid orders first.
       */
      await tx.order.deleteMany({
        where: {
          projectId: project.id,
          status: {
            not: "PAID",
          },
        },
      });

      /*
       * Delete project media.
       */
      await tx.projectMedia.deleteMany({
        where: {
          projectId: project.id,
        },
      });

      /*
       * Delete revisions.
       */
      await tx.projectRevision.deleteMany({
        where: {
          projectId: project.id,
        },
      });

      /*
       * Finally delete the project.
       */
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
    console.error(
      "Delete project failed:",
      error,
    );

    return res.status(500).json({
      error: "Unable to delete draft",
    });
  }
});

export default r;