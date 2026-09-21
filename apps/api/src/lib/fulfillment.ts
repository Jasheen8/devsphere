import crypto from "node:crypto";
import { db } from "./db.js";

const SPECIAL_REVEAL_METHODS = [
  "QR",
  "PIN",
  "LETTER",
  "GIFT",
  "PUZZLE",
] as const;

type CheckoutCurrency = "INR" | "USD";
type RevealMethod = "NORMAL" | "QR" | "PIN" | "LETTER" | "GIFT" | "PUZZLE";

export function calculateBirthdayPackage(args: {
  projectData: Record<string, unknown>;
  revealMethod: RevealMethod;
  currency: CheckoutCurrency;
}) {
  const movieEnabled = args.projectData.movieEnabled === true;
  const specialReveal = SPECIAL_REVEAL_METHODS.includes(
    args.revealMethod as any,
  );

  const packagePrice = specialReveal ? 119 : movieEnabled ? 109 : 99;
  const providerAmount =
  args.currency === "USD"
    ? 10
    : packagePrice;

  return {
    packagePrice,
    providerAmount,
    providerAmountMinor: Math.round(providerAmount * 100),
    specialReveal,
    movieEnabled,
  };
}

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

async function makeUniqueSlug(tx: any, base: string) {
  const clean = slugBase(base);
  const reserved = new Set([
    "api",
    "admin",
    "login",
    "register",
    "r",
    "dashboard",
    "settings",
  ]);

  const root = reserved.has(clean) ? `${clean}-gift` : clean;
  let slug = root;
  let counter = 2;

  while (await tx.publishedSite.findUnique({ where: { slug } })) {
    slug = `${root}-${counter++}`;
  }

  return slug;
}

async function publishInsideTransaction(tx: any, order: any) {
  const project = order.project;

  if (project.status !== "FINALIZED" && project.status !== "PUBLISHED") {
    throw new Error("Project must be finalized before publishing");
  }

  const limits = (order.plan?.limits || {}) as Record<string, unknown>;
  const expirationDays = limits.expirationDays;
  const expiresAt =
    typeof expirationDays === "number"
      ? new Date(Date.now() + expirationDays * 86_400_000)
      : null;

  let site = await tx.publishedSite.findUnique({
    where: { projectId: project.id },
  });

  if (!site) {
    const slug = await makeUniqueSlug(tx, project.name);

    site = await tx.publishedSite.create({
      data: {
        projectId: project.id,
        slug,
        status: "ACTIVE",
        revealMethod: project.revealMethod,
        expiresAt,
      },
    });
  } else {
    site = await tx.publishedSite.update({
      where: { id: site.id },
      data: {
        status: "ACTIVE",
        revealMethod: project.revealMethod,
        expiresAt,
      },
    });
  }

  if (project.status !== "PUBLISHED") {
    await tx.project.update({
      where: { id: project.id },
      data: {
        status: "PUBLISHED",
        publishedAt: project.publishedAt || new Date(),
      },
    });
  }

  return site;
}

function getProviderAmountMinor(
  provider: "razorpay" | "paypal",
  providerAmount: number,
) {
  if (!Number.isFinite(providerAmount) || providerAmount <= 0) {
    throw new Error("Invalid provider amount");
  }

  // finalizePaidOrder receives providerAmount in major currency units:
  // Razorpay: 119 INR
  // PayPal:   10 USD
  //
  // Database order.amount is always stored in minor units:
  // ₹119 -> 11900
  // $10  -> 1000

  return Math.round(providerAmount * 100);
}

export async function finalizePaidOrder(args: {
  orderId: string;
  userId?: string;
  provider: "razorpay" | "paypal";
  providerPaymentId: string;
  signature?: string | null;
  raw?: unknown;
  providerAmount: number;
  providerCurrency: "INR" | "USD";
}) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: args.orderId },
      include: {
        project: true,
        plan: true,
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (args.userId && order.userId !== args.userId) {
      throw new Error("Order not found");
    }

    if (order.provider !== args.provider) {
      throw new Error("Payment provider mismatch");
    }

    if (order.currency !== args.providerCurrency) {
      throw new Error("Payment currency mismatch");
    }

    const providerAmountMinor = getProviderAmountMinor(
  args.provider,
  args.providerAmount,
);

const expectedAmountMinor = Number(order.amount);

if (providerAmountMinor !== expectedAmountMinor) {
  throw new Error(
    `Payment amount mismatch: received ${providerAmountMinor}, expected ${expectedAmountMinor}`,
  );
}

    if (
      order.status === "PAID" &&
      order.providerPaymentId &&
      order.providerPaymentId !== args.providerPaymentId
    ) {
      throw new Error("Order has already been paid with another payment");
    }

    const paymentId = `${args.provider}-${crypto
      .createHash("sha256")
      .update(args.providerPaymentId)
      .digest("hex")}`;

    await tx.payment.upsert({
      where: { id: paymentId },
      update: {
        status: "CAPTURED",
        providerPaymentId: args.providerPaymentId,
        signature: args.signature || undefined,
        amount: order.amount,
        currency: order.currency,
        raw: args.raw as any,
      },
      create: {
        id: paymentId,
        orderId: order.id,
        provider: args.provider,
        status: "CAPTURED",
        amount: order.amount,
        currency: order.currency,
        providerPaymentId: args.providerPaymentId,
        signature: args.signature || undefined,
        raw: {
          providerAmount: args.providerAmount,
          providerCurrency: args.providerCurrency,
          payload: args.raw ?? null,
        } as any,
      },
    });

    const paidOrder =
      order.status === "PAID"
        ? order
        : await tx.order.update({
            where: { id: order.id },
            data: {
              status: "PAID",
              providerPaymentId: args.providerPaymentId,
            },
            include: {
              project: true,
              plan: true,
            },
          });

    const site = await publishInsideTransaction(tx, paidOrder);

    return {
      ok: true,
      orderId: paidOrder.id,
      status: "PAID" as const,
      alreadyPaid: order.status === "PAID",
      slug: site.slug,
      url: `${process.env.APP_URL || "http://localhost:5173"}/r/${site.slug}`,
    };
  });
}

export async function publishPaidProject(projectId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, userId },
      include: {
        orders: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
        website: true,
      },
    });

    if (!project) {
      throw new Error("Project not found");
    }

    const paidOrder = project.orders[0];

    if (!paidOrder) {
      throw new Error("Payment required");
    }

    const order = {
      ...paidOrder,
      project,
      plan: paidOrder.plan,
    };

    const site = await publishInsideTransaction(tx, order);

    return {
      ok: true,
      alreadyPublished:
        project.status === "PUBLISHED" && Boolean(project.website),
      slug: site.slug,
      url: `${process.env.APP_URL || "http://localhost:5173"}/r/${site.slug}`,
    };
  });
}
