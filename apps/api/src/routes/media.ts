import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { auth } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { hasOpenPaidEditWindow } from "../lib/paid-edit-window.js";
import { presignUpload, publicUrl } from "../lib/storage.js";
const r = Router();
r.use(auth);
const schema = z.object({
  projectId: z.string(),
  kind: z.enum(["image", "video", "audio"]),
  mimeType: z.string().regex(/^(image|video|audio)\//),
  size: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  originalName: z.string().max(180),
});
r.post("/presign", async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success)
    return res
      .status(400)
      .json({ error: "Invalid upload", details: p.error.flatten() });
  const u = (req as any).user;
  const project = await db.project.findFirst({
    where: { id: p.data.projectId, userId: u.id },
    include: {
      orders: {
        where: { status: "PAID" },
        include: {
          payments: {
            where: { status: "CAPTURED" },
            select: { status: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (
    project.status === "PUBLISHED" &&
    !hasOpenPaidEditWindow(project.orders)
  ) {
    return res.status(403).json({
      error: "The 24-hour editing period for this website has ended.",
    });
  }
  const key = `users/${u.id}/projects/${project.id}/${crypto.randomUUID()}-${p.data.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const uploadUrl = await presignUpload(key, p.data.mimeType);
  res.json({ uploadUrl, key, url: publicUrl(key) });
});
r.post("/attach", async (req, res) => {
  const p = z
    .object({
      projectId: z.string(),
      kind: z.enum(["image", "video", "audio"]),
      url: z.string().url(),
      storageKey: z.string(),
      mimeType: z.string(),
      size: z.number().int().positive().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid media" });
  const u = (req as any).user;
  const project = await db.project.findFirst({
    where: { id: p.data.projectId, userId: u.id },
    include: {
      orders: {
        where: { status: "PAID" },
        include: {
          payments: {
            where: { status: "CAPTURED" },
            select: { status: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (
    project.status === "PUBLISHED" &&
    !hasOpenPaidEditWindow(project.orders)
  ) {
    return res.status(403).json({
      error: "The 24-hour editing period for this website has ended.",
    });
  }
  const count = await db.projectMedia.count({
    where: { projectId: project.id },
  });
  if (
    project.status === "PUBLISHED" &&
    !hasOpenPaidEditWindow(project.orders)
  ) {
    return res.status(403).json({
      error: "The 24-hour editing period for this website has ended.",
    });
  }
  const media = await db.projectMedia.create({
    data: { ...p.data, sortOrder: count },
  });
  res.status(201).json({ media });
});
r.delete("/:id", async (req, res) => {
  const u = (req as any).user;
  const media = await db.projectMedia.findFirst({
    where: { id: req.params.id, project: { userId: u.id } },
    include: {
      project: {
        include: {
          orders: {
            where: { status: "PAID" },
            include: {
              payments: {
                where: { status: "CAPTURED" },
                select: { status: true, createdAt: true },
              },
            },
          },
        },
      },
    },
  });
  if (!media) return res.status(404).json({ error: "Media not found" });
  if (
    media.project.status === "PUBLISHED" &&
    !hasOpenPaidEditWindow(media.project.orders)
  ) {
    return res.status(403).json({
      error: "The 24-hour editing period for this website has ended.",
    });
  }
  await db.projectMedia.delete({ where: { id: media.id } });
  res.status(204).end();
});
export default r;
