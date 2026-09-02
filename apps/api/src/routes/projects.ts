import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";

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

  data: z
    .record(z.unknown())
    .default({}),

  customization: z
    .record(z.unknown())
    .default({}),

  revealMethod:
    revealMethodSchema.default("NORMAL"),
});

/* =========================================================
   CREATE PROJECT
   ========================================================= */

r.post("/", auth, async (req, res) => {
  const p =
    projectInput.safeParse(req.body);

  if (!p.success) {
    return res.status(400).json({
      error: "Invalid project",
    });
  }

  const u = (req as any).user;

  const t =
    await db.template.findUnique({
      where: {
        id: p.data.templateId,
      },
    });

  if (!t || !t.published) {
    return res.status(404).json({
      error: "Template not found",
    });
  }

  const project =
    await db.project.create({
      data: {
        userId: u.id,

        templateId:
          t.id,

        name:
          p.data.name,

        data:
          p.data.data as Prisma.InputJsonValue,

        customization:
          p.data.customization as Prisma.InputJsonValue,

        revealMethod:
          p.data.revealMethod,
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

  const p =
    projectInput
      .partial()
      .safeParse(req.body);

  if (!p.success) {
    return res.status(400).json({
      error: "Invalid project",
    });
  }

  const projectId =
    typeof req.params.id === "string"
      ? req.params.id
      : req.params.id[0];

  const existing =
    await db.project.findFirst({
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

  const project =
    await db.$transaction(
      async (tx) => {
        await tx.projectRevision.create({
          data: {
            projectId:
              existing.id,

            data:
              existing.data === null
                ? Prisma.JsonNull
                : (
                    existing.data as
                      Prisma.InputJsonValue
                  ),

            customization:
              existing.customization === null
                ? Prisma.JsonNull
                : (
                    existing.customization as
                      Prisma.InputJsonValue
                  ),

            status:
              existing.status,
          },
        });

        const updateData:
          Prisma.ProjectUpdateInput = {};

        if (
          p.data.name !==
          undefined
        ) {
          updateData.name =
            p.data.name;
        }

        if (
          p.data.data !==
          undefined
        ) {
          updateData.data =
            p.data.data as
              Prisma.InputJsonValue;
        }

        if (
          p.data.customization !==
          undefined
        ) {
          updateData.customization =
            p.data.customization as
              Prisma.InputJsonValue;
        }

        if (
          p.data.revealMethod !==
          undefined
        ) {
          updateData.revealMethod =
            p.data.revealMethod;
        }

        if (
          p.data.templateId !==
          undefined
        ) {
          updateData.template = {
            connect: {
              id:
                p.data.templateId,
            },
          };
        }

        return tx.project.update({
          where: {
            id: existing.id,
          },

          data:
            updateData,
        });
      },
    );

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
   GET SINGLE PROJECT
   ========================================================= */

r.get("/:id", auth, async (req, res) => {
  const projectId =
    typeof req.params.id === "string"
      ? req.params.id
      : req.params.id[0];

  const u = (req as any).user;

  const project =
    await db.project.findFirst({
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

export default r;