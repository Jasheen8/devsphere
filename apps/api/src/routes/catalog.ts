import { Router } from "express";

import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";

const r = Router();

function getParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

r.get("/categories", async (_req, res) => {
  const items = await db.category.findMany({
    where: {
      published: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  res.json({
    items,
  });
});

r.get("/templates", async (req, res) => {
  const category =
    typeof req.query.category === "string"
      ? req.query.category
      : undefined;

  const search =
    typeof req.query.search === "string"
      ? req.query.search
      : undefined;

  const featured =
    typeof req.query.featured === "string"
      ? req.query.featured
      : undefined;

  const items = await db.template.findMany({
    where: {
      published: true,

      ...(featured === "true"
        ? {
            featured: true,
          }
        : {}),

      ...(category
        ? {
            category: {
              slug: category,
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    include: {
      category: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  res.json({
    items,
  });
});

r.get("/pricing", async (_req, res) => {
  const items = await db.pricingPlan.findMany({
    where: {
      active: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  res.json({
    items,
  });
});

r.get("/templates/:id", async (req, res) => {
  const templateId = getParam(req.params.id);

  const t = await db.template.findFirst({
    where: {
      OR: [
        {
          id: templateId,
        },
        {
          slug: templateId,
        },
      ],
      published: true,
    },

    include: {
      category: true,
    },
  });

  if (!t) {
    return res.status(404).json({
      error: "Template not found",
    });
  }

  res.json({
    template: t,
  });
});

r.post("/templates/:id/favorite", auth, async (req, res) => {
  const u = (req as any).user;

  const templateId = getParam(req.params.id);

  const t = await db.template.findFirst({
    where: {
      OR: [
        {
          id: templateId,
        },
        {
          slug: templateId,
        },
      ],
      published: true,
    },
  });

  if (!t) {
    return res.status(404).json({
      error: "Template not found",
    });
  }

  await db.favorite.upsert({
    where: {
      userId_templateId: {
        userId: u.id,
        templateId: t.id,
      },
    },

    update: {},

    create: {
      userId: u.id,
      templateId: t.id,
    },
  });

  res.json({
    ok: true,
  });
});

r.delete("/templates/:id/favorite", auth, async (req, res) => {
  const u = (req as any).user;

  const templateId = getParam(req.params.id);

  const t = await db.template.findFirst({
    where: {
      OR: [
        {
          id: templateId,
        },
        {
          slug: templateId,
        },
      ],
    },
  });

  if (!t) {
    return res.status(404).json({
      error: "Template not found",
    });
  }

  await db.favorite.deleteMany({
    where: {
      userId: u.id,
      templateId: t.id,
    },
  });

  res.status(204).end();
});

export default r;