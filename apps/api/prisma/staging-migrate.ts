import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadAndValidateStagingEnvironment } from "../src/lib/staging-safety.js";

function sanitizedOutput(output: string, urls: string[]) {
  return urls.reduce((text, url) => text.split(url).join("[redacted database URL]"), output);
}

async function legacyDataFingerprint(db: PrismaClient) {
  const publicTables = await db.$queryRaw<Array<{ relname: string }>>`
    SELECT c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  `;
  const requiredTables = new Set(["User", "Template", "Order", "Payment", "Project"]);
  const presentTables = new Set(publicTables.map((table) => table.relname));
  const hasRequiredTables = [...requiredTables].every((table) => presentTables.has(table));

  if (publicTables.length > 0 && !hasRequiredTables) {
    throw new Error("Staging database has a partial application schema; refusing migration.");
  }

  const freshEmptySchema = publicTables.length === 0;
  if (freshEmptySchema) {
    const emptyRows = { users: [], templates: [], orders: [], payments: [], projects: [] };
    return {
      freshEmptySchema,
      counts: { users: 0, templates: 0, orders: 0, payments: 0, projects: 0 },
      sha256: createHash("sha256").update(JSON.stringify(emptyRows)).digest("hex"),
    };
  }

  const [users, templates, orders, payments, projects] = await Promise.all([
    db.user.findMany({ select: { id: true, email: true, role: true, status: true, createdAt: true, updatedAt: true }, orderBy: { id: "asc" } }),
    db.template.findMany({ select: { id: true, slug: true, name: true, published: true, isFree: true, price: true, updatedAt: true }, orderBy: { id: "asc" } }),
    db.order.findMany({ select: { id: true, userId: true, projectId: true, planId: true, amount: true, currency: true, status: true, provider: true, providerOrderId: true, providerPaymentId: true, removeWatermark: true, createdAt: true, updatedAt: true }, orderBy: { id: "asc" } }),
    db.payment.findMany({ select: { id: true, orderId: true, provider: true, status: true, amount: true, currency: true, providerPaymentId: true, createdAt: true, updatedAt: true }, orderBy: { id: "asc" } }),
    db.project.findMany({ select: { id: true, userId: true, templateId: true, name: true, status: true, data: true, customization: true, finalizedAt: true, publishedAt: true, createdAt: true, updatedAt: true }, orderBy: { id: "asc" } }),
  ]);
  const payload = JSON.stringify({ users, templates, orders, payments, projects });
  return {
    freshEmptySchema,
    counts: { users: users.length, templates: templates.length, orders: orders.length, payments: payments.length, projects: projects.length },
    sha256: createHash("sha256").update(payload).digest("hex"),
  };
}

try {
  const { stageUrl, directUrl, expectedRef } = loadAndValidateStagingEnvironment();
  console.log(
    `Staging target preflight passed for project ${expectedRef}; pooler host ${new URL(stageUrl).hostname}; direct host ${new URL(directUrl).hostname}; target differs from configured application database.`,
  );
  const apiDir = path.resolve(process.cwd());
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error("Run this command through npm so it can use the repository migration workflow.");

  const db = new PrismaClient({ datasources: { db: { url: directUrl } } });
  let before;
  try {
    await db.$connect();
    before = await legacyDataFingerprint(db);
    if (before.freshEmptySchema) {
      console.log("Fresh empty staging schema detected; there are no legacy user/template/order/payment/project rows to preserve.");
    }
  } finally {
    await db.$disconnect();
  }

  const result = spawnSync(process.execPath, [npmExecPath, "run", "prisma:migrate:deploy", "--", "--schema", "prisma/schema.prisma"], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: stageUrl, DIRECT_URL: directUrl },
    encoding: "utf8",
    windowsHide: true,
  });
  const output = sanitizedOutput(`${result.stdout || ""}${result.stderr || ""}`, [stageUrl, directUrl]);
  if (output.trim()) process.stdout.write(output);
  if (result.error) throw new Error("Prisma migration process could not start.");
  if (result.status !== 0) throw new Error(`Prisma migrate deploy failed for isolated staging project ${expectedRef}.`);
  const verifiedDb = new PrismaClient({ datasources: { db: { url: directUrl } } });
  let after;
  try {
    await verifiedDb.$connect();
    after = await legacyDataFingerprint(verifiedDb);
  } finally {
    await verifiedDb.$disconnect();
  }
  if (
    JSON.stringify(before.counts) !== JSON.stringify(after.counts) ||
    before.sha256 !== after.sha256
  ) {
    throw new Error(`Staging migration changed legacy user/template/order/payment/project data for project ${expectedRef}.`);
  }
  console.log(`Existing-data fingerprint unchanged (users ${before.counts.users}, templates ${before.counts.templates}, orders ${before.counts.orders}, payments ${before.counts.payments}, projects ${before.counts.projects}).`);
  console.log(`Migration deployment completed for isolated staging project ${expectedRef}.`);
} catch (error: any) {
  let message = String(error?.message || "Staging migration did not run.");
  for (const url of [process.env.AFFILIATE_STAGING_DATABASE_URL, process.env.AFFILIATE_STAGING_DIRECT_URL].filter(Boolean) as string[]) {
    message = message.split(url).join("[redacted staging database URL]");
  }
  console.error(message);
  process.exitCode = 1;
}
