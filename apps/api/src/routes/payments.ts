import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";
import {
  captureRazorpayPaymentIfAuthorized,
  createRazorpayOrder,
  fetchRazorpayPayments,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "../lib/payment.js";
import {
  capturePayPalOrder,
  createPayPalOrder,
  extractPayPalCapture,
  extractPayPalOrderIdFromCaptureWebhook,
  getPayPalClientId,
  getPayPalSetupError,
  isPayPalConfigured,
  getPayPalOrder,
  verifyPayPalWebhook,
} from "../lib/paypal.js";
import {
  calculateTemplatePackagePricing,
  finalizePaidOrder,
  publishPaidProject,
} from "../lib/fulfillment.js";
import {
  ACTIVE_COUPON_ORDER_STATUSES,
  canReuseCouponReservation,
  calculateCouponAmounts,
  CouponValidationError,
  normalizeCouponCode,
  WHATSAPP_INSIDER_COUPON_CODE,
  WHATSAPP_INSIDER_DISCOUNT_PERCENT,
} from "../lib/insider-coupon.js";

const r = Router();

const checkoutSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  currency: z.enum(["INR", "USD"]).default("INR"),
  revealMethod: z
    .enum(["NORMAL", "QR", "PIN", "LETTER", "GIFT", "PUZZLE"])
    .default("NORMAL"),
  scannerStyle: z.enum(["HEART", "SQUARE"]).nullable().optional(),
  unlockPin: z.string().min(4).max(64).optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

const quoteSchema = z.object({
  projectId: z.string().min(1),
  currency: z.enum(["INR", "USD"]).default("INR"),
  revealMethod: z
    .enum(["NORMAL", "QR", "PIN", "LETTER", "GIFT", "PUZZLE"])
    .default("NORMAL"),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

const REVEAL_METHODS = ["NORMAL", "QR", "PIN", "LETTER", "GIFT", "PUZZLE"] as const;

function getCheckoutRevealMethod(
  templateSlug: string,
  currency: "INR" | "USD",
  requestedRevealMethod: (typeof REVEAL_METHODS)[number],
) {
  if (templateSlug === "navratri-partner-invite") return "NORMAL";
  if (templateSlug === "my-hero-magazine" && currency === "USD") {
    return requestedRevealMethod === "PIN" ? "PIN" : "QR";
  }
  return requestedRevealMethod;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildCouponQuote(
  amountMinor: number,
  currency: "INR" | "USD",
  requestedCode: unknown,
) {
  const code = normalizeCouponCode(requestedCode);
  const applied = calculateCouponAmounts(amountMinor, code);
  const preview = calculateCouponAmounts(
    amountMinor,
    WHATSAPP_INSIDER_COUPON_CODE,
  );
  return {
    currency,
    originalAmountMinor: amountMinor,
    discountAmountMinor: applied.discountAmountMinor,
    finalAmountMinor: applied.finalAmountMinor,
    couponCode: applied.couponCode,
    couponPreviewDiscountMinor: preview.discountAmountMinor,
    couponPreviewAmountMinor: preview.finalAmountMinor,
    couponPercent: WHATSAPP_INSIDER_DISCOUNT_PERCENT,
  };
}

function jsonBody(req: any) {
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString("utf8"));
  }

  return req.body;
}

async function failIfPaid(projectId: string, userId: string, res: any) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    include: {
      template: true,
      website: true,
      orders: {
        where: { status: "PAID" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return true;
  }

  if (project.template.isFree) {
    res.status(409).json({ error: "This free template publishes without checkout." });
    return true;
  }

  if (project.status === "PUBLISHED" && project.website) {
    res.json({
      alreadyPaid: true,
      alreadyPublished: true,
      provider: project.orders[0]?.provider || "unknown",
      url: `${process.env.APP_URL || "http://localhost:5173"}/r/${project.website.slug}`,
    });
    return true;
  }

  if (project.orders[0]) {
    try {
      const published = await publishPaidProject(project.id, userId);

      res.json({
        alreadyPaid: true,
        alreadyPublished: true,
        provider: project.orders[0].provider,
        url: published.url,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message || "Unable to restore your paid website.",
      });
    }

    return true;
  }

  return false;
}

r.get("/config", auth, (_req, res) => {
  const paypalEnabled = isPayPalConfigured();

  res.json({
    paypalClientId: paypalEnabled ? getPayPalClientId() : "",
    paypalEnabled,
    paypalError: paypalEnabled ? "" : getPayPalSetupError(),
  });
});

r.get("/template-quote/:slug", async (req, res) => {
  const slug = String(req.params.slug || "");
  const template = await db.template.findFirst({
    where: {
      OR: [{ id: slug }, { slug }],
      published: true,
    },
    select: {
      id: true,
      slug: true,
      isFree: true,
      defaultData: true,
    },
  });

  if (!template) return res.status(404).json({ error: "Template not found" });
  if (template.isFree) {
    return res.json({ templateSlug: template.slug, isFree: true, quotes: [] });
  }

  const projectData = asRecord(template.defaultData);
  const quotes = (["INR", "USD"] as const).map((currency) => {
    const pricing = calculateTemplatePackagePricing({
      templateSlug: template.slug,
      projectData,
      currency,
      revealMethod: "NORMAL",
      removeWatermark: template.slug === "my-hero-magazine" && currency === "USD",
    });
    return buildCouponQuote(pricing.providerAmountMinor, currency, null);
  });

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return res.json({ templateSlug: template.slug, isFree: false, quotes });
});

r.post("/quote", auth, async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid quote request" });

  const user = (req as any).user;
  const data = parsed.data;

  try {
    const project = await db.project.findFirst({
      where: { id: data.projectId, userId: user.id },
      include: { template: true },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.template.isFree) {
      return res.status(409).json({ error: "Free templates do not need a coupon." });
    }

    const templateSlug = project.template.slug;
    if (
      templateSlug === "my-hero-magazine" &&
      !["NORMAL", "QR", "PIN"].includes(data.revealMethod)
    ) {
      return res.status(400).json({ error: "This template does not support that reveal option." });
    }

    const revealMethod = getCheckoutRevealMethod(
      templateSlug,
      data.currency,
      data.revealMethod,
    );
    const customization = asRecord(project.customization);
    const removeWatermark = [
      "birthday-royal-memory",
      "anniversary-romantic-01",
      "navratri-partner-invite",
      "my-hero-magazine",
    ].includes(templateSlug) && customization.removeWatermark === true;
    const pricing = calculateTemplatePackagePricing({
      templateSlug,
      projectData: asRecord(project.data),
      currency: data.currency,
      revealMethod,
      removeWatermark,
    });
    const quote = buildCouponQuote(
      pricing.providerAmountMinor,
      data.currency,
      data.couponCode,
    );

    const activeRedemption = await db.order.findFirst({
      where: {
        userId: user.id,
        couponCode: WHATSAPP_INSIDER_COUPON_CODE,
        status: { in: [...ACTIVE_COUPON_ORDER_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
    });
    const couponReservationQuote = calculateCouponAmounts(
      pricing.providerAmountMinor,
      WHATSAPP_INSIDER_COUPON_CODE,
    );
    const couponAvailable = canReuseCouponReservation(activeRedemption, {
      projectId: project.id,
      currency: data.currency,
      finalAmountMinor: couponReservationQuote.finalAmountMinor,
      originalAmountMinor: couponReservationQuote.originalAmountMinor,
      discountAmountMinor: couponReservationQuote.discountAmountMinor,
    });
    if (quote.couponCode && !couponAvailable) {
      return res.status(409).json({
        error: "INSIDER10 has already been used or is reserved by another checkout on this account.",
      });
    }

    return res.json({ ...quote, couponAvailable });
  } catch (error: any) {
    if (error instanceof CouponValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Checkout quote failed:", error);
    return res.status(500).json({ error: "Unable to calculate checkout price." });
  }
});

r.post("/create-order", auth, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid checkout data" });
  }

  const user = (req as any).user;
  const data = parsed.data;

  let createdOrderId: string | null = null;
  let providerRequestInFlight = false;

  try {
    if (await failIfPaid(data.projectId, user.id, res)) {
      return;
    }

    const [project, plan] = await Promise.all([
      db.project.findFirst({
        where: { id: data.projectId, userId: user.id },
        include: { template: true },
      }),
      db.pricingPlan.findUnique({ where: { id: data.planId } }),
    ]);

    if (!project || !plan || !plan.active) {
      return res.status(404).json({ error: "Project or plan not found" });
    }

    if (project.template.isFree) {
      return res.status(409).json({ error: "This free template publishes without checkout." });
    }

    const isBloomAnniversary =
      project.template.slug === "anniversary-romantic-01";
    const isNavratri =
      project.template.slug === "navratri-partner-invite";
    const isWeddingInvitation =
      project.template.slug === "wedding-invitation";
    const isMyHeroMagazine = project.template.slug === "my-hero-magazine";
    const checkoutRevealMethod = getCheckoutRevealMethod(
      project.template.slug,
      data.currency,
      data.revealMethod,
    );

    if (
      isMyHeroMagazine &&
      !["NORMAL", "QR", "PIN"].includes(data.revealMethod)
    ) {
      return res.status(400).json({
        error: "Special Magazine supports Normal, Heart Scanner, or Code Lock reveals.",
      });
    }
    if (isMyHeroMagazine && data.revealMethod === "PIN" && !data.unlockPin?.trim()) {
      return res.status(400).json({ error: "Enter a 4 to 64 character Code Lock PIN." });
    }

    if (project.status !== "FINALIZED" && !isMyHeroMagazine) {
      return res.status(409).json({ error: "Finalize the project first" });
    }

    if (isMyHeroMagazine) {
      const fields = Array.isArray((project.template.schema as any)?.fields)
        ? (project.template.schema as any).fields
        : [];
      const projectData = (project.data as Record<string, unknown> | null) || {};
      const missing = fields
        .filter((field: any) => field.required)
        .filter((field: any) => String(projectData[field.id] ?? "").trim() === "")
        .map((field: any) => field.label || field.id);
      if (missing.length > 0) {
        return res.status(400).json({ error: `Please complete: ${missing.join(", ")}` });
      }
    }

    if (data.currency === "USD" && !isPayPalConfigured()) {
      return res
        .status(503)
        .json({
          error:
            getPayPalSetupError() ||
            "International payments are not configured yet.",
        });
    }

    const projectData = (project.data as Record<string, unknown> | null) || {};
    const projectCustomization =
      project.customization &&
      typeof project.customization === "object" &&
      !Array.isArray(project.customization)
        ? (project.customization as Record<string, unknown>)
        : {};
    const removeWatermark =
      [
        "birthday-royal-memory",
        "anniversary-romantic-01",
        "navratri-partner-invite",
        "my-hero-magazine",
      ].includes(project.template.slug) &&
      projectCustomization.removeWatermark === true;

    const magazineRemoveWatermark = isMyHeroMagazine &&
      (data.currency === "USD" || projectCustomization.removeWatermark === true);
    const pricing = calculateTemplatePackagePricing({
      templateSlug: project.template.slug,
      projectData,
      revealMethod: checkoutRevealMethod,
      currency: data.currency,
      removeWatermark: magazineRemoveWatermark || removeWatermark,
    });
    const couponCode = normalizeCouponCode(data.couponCode);
    const payable = calculateCouponAmounts(pricing.providerAmountMinor, couponCode);

    if (couponCode) {
      const activeRedemption = await db.order.findFirst({
        where: {
          userId: user.id,
          couponCode,
          status: { in: [...ACTIVE_COUPON_ORDER_STATUSES] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeRedemption) {
        const provider = data.currency === "USD" ? "paypal" : "razorpay";
        const samePendingCheckout = canReuseCouponReservation(activeRedemption, {
          projectId: project.id,
          currency: data.currency,
          finalAmountMinor: payable.finalAmountMinor,
          originalAmountMinor: payable.originalAmountMinor,
          discountAmountMinor: payable.discountAmountMinor,
          provider,
          planId: plan.id,
        });

        if (samePendingCheckout && activeRedemption.providerOrderId) {
          return res.status(200).json({
            orderId: activeRedemption.id,
            provider: activeRedemption.provider,
            providerOrderId: activeRedemption.providerOrderId,
            amount: activeRedemption.provider === "paypal"
              ? activeRedemption.amount / 100
              : activeRedemption.amount,
            currency: activeRedemption.currency,
            originalAmountMinor: activeRedemption.originalAmount,
            discountAmountMinor: activeRedemption.discountAmount,
            couponCode: activeRedemption.couponCode,
            ...(activeRedemption.provider === "paypal"
              ? { clientId: getPayPalClientId() }
              : { keyId: process.env.RAZORPAY_KEY_ID || "" }),
          });
        }

        return res.status(409).json({
          error: "INSIDER10 is already reserved or redeemed by another checkout on this account.",
        });
      }
    }

    const updatedData = {
      ...projectData,
      packageBasePrice: pricing.basePackagePrice,
      packagePrice: pricing.packagePrice,
      removeWatermark: pricing.removeWatermark,
      packageCurrency: data.currency,
      packageProvider: data.currency === "USD" ? "paypal" : "razorpay",
      packageProviderAmount: payable.finalAmountMinor / 100,
      scannerStyle:
        checkoutRevealMethod === "QR" ? data.scannerStyle || "HEART" : null,
    };

    const updatedCustomization = { ...projectCustomization };
    if (isMyHeroMagazine) {
      if (checkoutRevealMethod === "PIN") {
        updatedCustomization.magazineUnlockPinHash = await bcrypt.hash(data.unlockPin!.trim(), 12);
      } else {
        delete updatedCustomization.magazineUnlockPinHash;
      }
    }

    await db.project.update({
      where: { id: project.id },
      data: {
        revealMethod: checkoutRevealMethod,
        data: updatedData,
        ...(isMyHeroMagazine
          ? { customization: updatedCustomization as Prisma.InputJsonValue }
          : {}),
      },
    });

    const provider = data.currency === "USD" ? "paypal" : "razorpay";

    const existingPending = await db.order.findFirst({
      where: {
        projectId: project.id,
        userId: user.id,
        status: "PENDING",
        provider,
        planId: plan.id,
        amount: payable.finalAmountMinor,
        currency: data.currency,
        removeWatermark: pricing.removeWatermark,
        ...(couponCode
          ? {
              originalAmount: payable.originalAmountMinor,
              discountAmount: payable.discountAmountMinor,
            }
          : {}),
        couponCode,
      },
      orderBy: { createdAt: "desc" },
    });

    // Reuse a coupon order so a customer's single-use reservation stays attached
    // to the same provider order while they retry checkout.
    if (existingPending?.providerOrderId && (provider === "paypal" || couponCode)) {
      return res.status(200).json({
        orderId: existingPending.id,
        provider: existingPending.provider,
        providerOrderId: existingPending.providerOrderId,
        amount: provider === "paypal"
          ? existingPending.amount / 100
          : existingPending.amount,
        currency: existingPending.currency,
        originalAmountMinor: existingPending.originalAmount,
        discountAmountMinor: existingPending.discountAmount,
        couponCode: existingPending.couponCode,
        ...(provider === "paypal"
          ? { clientId: getPayPalClientId() }
          : { keyId: process.env.RAZORPAY_KEY_ID || "" }),
      });
    }

    const order = await db.order.create({
      data: {
        userId: user.id,
        projectId: project.id,
        planId: plan.id,
        amount: payable.finalAmountMinor,
        currency: data.currency,
        provider,
        removeWatermark: pricing.removeWatermark,
        originalAmount: payable.originalAmountMinor,
        discountAmount: payable.discountAmountMinor,
        couponCode: payable.couponCode,
      },
    });

    createdOrderId = order.id;

    if (provider === "razorpay") {
      providerRequestInFlight = true;
      const razorpayOrder = await createRazorpayOrder(
        payable.finalAmountMinor,
        order.id,
      );
      providerRequestInFlight = false;

      if (!razorpayOrder?.id) {
        throw new Error("Razorpay did not return an order ID.");
      }

      const saved = await db.order.update({
        where: { id: order.id },
        data: { providerOrderId: razorpayOrder.id },
      });

      return res.status(201).json({
        orderId: saved.id,
        provider: "razorpay",
        providerOrderId: razorpayOrder.id,
        amount: payable.finalAmountMinor,
        currency: "INR",
        originalAmountMinor: payable.originalAmountMinor,
        discountAmountMinor: payable.discountAmountMinor,
        couponCode: payable.couponCode,
        keyId: process.env.RAZORPAY_KEY_ID || "",
      });
    }

    providerRequestInFlight = true;
    const paypalOrder = await createPayPalOrder({
      amountUsd: payable.finalAmountMinor / 100,
      referenceId: order.id,
      description: `Devsphere ${isNavratri ? "Navratri Partner Invite" : isBloomAnniversary ? "Anniversary Bloom" : isWeddingInvitation ? "Wedding Invitation" : project.template.name} - ${
        pricing.specialReveal
          ? "Special Reveal"
          : pricing.movieEnabled
            ? "Our Movie"
            : "Basic"
      }${pricing.removeWatermark ? " + Remove Devsphere Credit" : ""}`,
    });
    providerRequestInFlight = false;

    if (!paypalOrder?.id) {
      throw new Error("PayPal did not return an order ID.");
    }

    const saved = await db.order.update({
      where: { id: order.id },
      data: { providerOrderId: paypalOrder.id },
    });

    return res.status(201).json({
      orderId: saved.id,
      provider: "paypal",
      providerOrderId: paypalOrder.id,
      amount: payable.finalAmountMinor / 100,
      currency: "USD",
      originalAmountMinor: payable.originalAmountMinor,
      discountAmountMinor: payable.discountAmountMinor,
      couponCode: payable.couponCode,
      clientId: getPayPalClientId(),
    });
  } catch (error: any) {
    console.error("Payment order creation failed:", error);

    if (createdOrderId) {
      await db.order
        .update({
          where: {
            id: createdOrderId,
          },
          data: {
            status: "FAILED",
          },
        })
        .catch((dbError) => {
          console.error("Failed to mark payment order as FAILED:", dbError);
        });
    }

    if (error?.code === "P2002" && data.couponCode) {
      return res.status(409).json({
        error: "INSIDER10 is already reserved or redeemed by another checkout on this account.",
      });
    }

    if (error instanceof CouponValidationError) {
      return res.status(400).json({ error: error.message });
    }

    const providerMessage =
      error?.error?.description ||
      error?.details?.[0]?.description ||
      error?.message;
    const safeProviderMessage =
      providerRequestInFlight &&
      typeof providerMessage === "string" &&
      providerMessage.trim()
        ? providerMessage.trim().slice(0, 240)
        : "Unable to start payment. Please retry or contact support.";

    return res.status(providerRequestInFlight ? 502 : 500).json({
      error: safeProviderMessage,
    });
  }
});

r.post("/razorpay/verify", auth, async (req, res) => {
  const parsed = z
    .object({
      orderId: z.string().min(1),
      razorpayOrderId: z.string().min(1),
      razorpayPaymentId: z.string().min(1),
      razorpaySignature: z.string().min(1),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Razorpay payment" });
  }

  const user = (req as any).user;
  const data = parsed.data;

  try {
    const order = await db.order.findFirst({
      where: { id: data.orderId, userId: user.id },
      include: { project: true },
    });

    if (
      !order ||
      order.provider !== "razorpay" ||
      order.providerOrderId !== data.razorpayOrderId
    ) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (
      !verifyRazorpayPaymentSignature(
        data.razorpayOrderId,
        data.razorpayPaymentId,
        data.razorpaySignature,
      )
    ) {
      return res.status(400).json({ error: "Signature verification failed" });
    }

    const expectedAmount = order.amount;
    const providerPayment = await captureRazorpayPaymentIfAuthorized(
      data.razorpayPaymentId,
      data.razorpayOrderId,
      expectedAmount,
    );

    if (
      providerPayment?.status !== "captured" ||
      Number(providerPayment?.amount) !== expectedAmount ||
      String(providerPayment?.currency) !== "INR" ||
      String(providerPayment?.order_id) !== data.razorpayOrderId
    ) {
      return res.status(400).json({
        error: "Razorpay payment is not captured or does not match the order",
      });
    }

    const result = await finalizePaidOrder({
      orderId: order.id,
      userId: user.id,
      provider: "razorpay",
      providerPaymentId: data.razorpayPaymentId,
      signature: data.razorpaySignature,
      raw: providerPayment,
      providerAmount: Number(providerPayment.amount) / 100,
      providerCurrency: "INR",
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Razorpay verification failed:", error);
    return res.status(500).json({
      error: error?.message || "Unable to verify Razorpay payment",
    });
  }
});

r.post("/paypal/capture", auth, async (req, res) => {
  const parsed = z
    .object({ paypalOrderId: z.string().min(1) })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid PayPal order" });
  }

  const user = (req as any).user;

  try {
    const order = await db.order.findFirst({
      where: {
        userId: user.id,
        provider: "paypal",
        providerOrderId: parsed.data.paypalOrderId,
      },
      include: { project: true },
    });

    if (!order) {
      return res.status(404).json({ error: "PayPal order not found" });
    }

    const current = await getPayPalOrder(parsed.data.paypalOrderId);
    let capture = extractPayPalCapture(current);
    let capturedOrder = current;

    if (current?.status !== "COMPLETED") {
      if (current?.status !== "APPROVED") {
        return res.status(409).json({
          error: `PayPal order is not ready for capture (${current?.status || "unknown"})`,
        });
      }

      capturedOrder = await capturePayPalOrder(
        parsed.data.paypalOrderId,
        order.id,
      );

      capture = extractPayPalCapture(capturedOrder);
    }

    if (!capture || capture.status !== "COMPLETED") {
      return res.status(409).json({
        error:
          "PayPal payment is not completed yet. Please wait and try again.",
      });
    }

    const expected = order.amount / 100;

    if (
      capture.currency !== "USD" ||
      Math.abs(capture.amount - expected) > 0.0001
    ) {
      return res.status(400).json({
        error: "PayPal payment amount does not match the order",
      });
    }

    const result = await finalizePaidOrder({
      orderId: order.id,
      userId: user.id,
      provider: "paypal",
      providerPaymentId: capture.id,
      raw: capturedOrder,
      providerAmount: capture.amount,
      providerCurrency: "USD",
    });

    return res.json(result);
  } catch (error: any) {
    console.error("PayPal capture failed:", error);
    return res.status(500).json({
      error: error?.message || "Unable to capture PayPal payment",
    });
  }
});

r.post("/resume/:projectId", auth, async (req, res) => {
  const projectId = String(req.params.projectId || "");
  const user = (req as any).user;

  try {
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        website: true,
        orders: {
          orderBy: { createdAt: "desc" },
          include: { plan: true },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.status === "PUBLISHED" && project.website) {
      const completedOrder = project.orders.find((item) => item.status === "PAID");
      return res.json({
        paid: true,
        url: `${process.env.APP_URL || "http://localhost:5173"}/r/${project.website.slug}`,
        ...(completedOrder
          ? {
              orderId: completedOrder.id,
              amount: completedOrder.amount,
              originalAmountMinor: completedOrder.originalAmount ?? completedOrder.amount,
              discountAmountMinor: completedOrder.discountAmount ?? 0,
              couponCode: completedOrder.couponCode,
              currency: completedOrder.currency,
            }
          : {}),
      });
    }

    const paidOrder = project.orders.find((item) => item.status === "PAID");

    if (paidOrder) {
      const published = await publishPaidProject(project.id, user.id);
      return res.json({
        paid: true,
        url: published.url,
        orderId: paidOrder.id,
        amount: paidOrder.amount,
        originalAmountMinor: paidOrder.originalAmount ?? paidOrder.amount,
        discountAmountMinor: paidOrder.discountAmount ?? 0,
        couponCode: paidOrder.couponCode,
        currency: paidOrder.currency,
      });
    }

    const resumableOrders = project.orders.filter(
      (item) =>
        (item.status === "PENDING" || item.status === "FAILED") &&
        item.providerOrderId,
    );

    for (const order of resumableOrders) {
      if (order.provider === "razorpay" && order.providerOrderId) {
        try {
          const payments = await fetchRazorpayPayments(order.providerOrderId);
          const successful = payments?.items?.find(
            (item: any) =>
              (item?.status === "captured" || item?.status === "authorized") &&
              item?.order_id === order.providerOrderId,
          );

          const expectedAmount = order.amount;

          if (
            successful &&
            Number(successful.amount) === expectedAmount &&
            String(successful.currency) === "INR"
          ) {
            const captured = await captureRazorpayPaymentIfAuthorized(
              successful.id,
              order.providerOrderId,
              expectedAmount,
            );

            if (captured?.status !== "captured") {
              continue;
            }

            const result = await finalizePaidOrder({
              orderId: order.id,
              userId: user.id,
              provider: "razorpay",
              providerPaymentId: captured.id,
              raw: captured,
              providerAmount: Number(captured.amount) / 100,
              providerCurrency: "INR",
            });

            return res.json({ ...result, paid: true });
          }
        } catch (error) {
          console.warn("Razorpay resume check failed", error);
        }
      }

      if (order.provider === "paypal" && order.providerOrderId) {
        try {
          const paypalOrder = await getPayPalOrder(order.providerOrderId);

          if (paypalOrder?.status === "APPROVED") {
            await capturePayPalOrder(order.providerOrderId, order.id);
          }

          const refreshed = await getPayPalOrder(order.providerOrderId);
          const capture = extractPayPalCapture(refreshed);
          const expected = order.amount / 100;

          if (
            capture?.status === "COMPLETED" &&
            capture.currency === "USD" &&
            Math.abs(capture.amount - expected) <= 0.0001
          ) {
            const result = await finalizePaidOrder({
              orderId: order.id,
              userId: user.id,
              provider: "paypal",
              providerPaymentId: capture.id,
              raw: refreshed,
              providerAmount: capture.amount,
              providerCurrency: "USD",
            });

            return res.json({ ...result, paid: true });
          }
        } catch (error) {
          console.warn("PayPal resume check failed", error);
        }
      }
    }

    return res.json({ paid: false });
  } catch (error: any) {
    console.error("Payment resume failed:", error);
    return res.status(500).json({
      error: error?.message || "Unable to check payment status",
    });
  }
});

r.post("/webhook/razorpay", async (req, res) => {
  try {
    const signature = String(req.headers["x-razorpay-signature"] || "");
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body ?? {});

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res
        .status(400)
        .json({ error: "Invalid Razorpay webhook signature" });
    }

    const event = jsonBody(req);
    const payment = event?.payload?.payment?.entity;

    if (!payment?.order_id) {
      return res.json({ received: true });
    }

    const order = await db.order.findFirst({
      where: { providerOrderId: payment.order_id, provider: "razorpay" },
      include: { project: true },
    });

    if (!order) {
      return res.json({ received: true });
    }

    if (
      event?.event === "payment.captured" ||
      event?.event === "payment.authorized"
    ) {
      const expectedAmount = order.amount;
      const currentPayment = await captureRazorpayPaymentIfAuthorized(
        String(payment.id || ""),
        order.providerOrderId || String(payment.order_id),
        expectedAmount,
      );

      if (currentPayment?.status === "captured") {
        await finalizePaidOrder({
          orderId: order.id,
          provider: "razorpay",
          providerPaymentId: currentPayment.id,
          raw: { event, payment: currentPayment },
          providerAmount: Number(currentPayment.amount) / 100,
          providerCurrency: "INR",
        });
      }
    } else if (event?.event === "payment.failed") {
      await db.order.updateMany({
        where: { id: order.id, status: { not: "PAID" } },
        data: {
          status: "FAILED",
          providerPaymentId: payment.id,
        },
      });
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook failed:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

r.post("/webhook/paypal", async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body ?? {});

    const verified = await verifyPayPalWebhook(req.headers as any, rawBody);

    if (!verified) {
      return res
        .status(400)
        .json({ error: "Invalid PayPal webhook signature" });
    }

    const event = JSON.parse(rawBody);
    const eventType = String(event?.event_type || "");

    if (eventType === "CHECKOUT.ORDER.APPROVED") {
      const providerOrderId = String(event?.resource?.id || "");
      const order = await db.order.findFirst({
        where: { providerOrderId, provider: "paypal" },
        include: { project: true },
      });

      if (order?.providerOrderId) {
        try {
          const current = await getPayPalOrder(order.providerOrderId);

          if (current?.status === "APPROVED") {
            await capturePayPalOrder(order.providerOrderId, order.id);
          }
        } catch (error) {
          console.error("PayPal approved webhook capture failed:", error);

          return res.status(500).json({
            error: "PayPal capture processing failed",
          });
        }
      }
    }

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const providerOrderId = extractPayPalOrderIdFromCaptureWebhook(event);
      const capture = event?.resource;

      if (providerOrderId && capture?.id) {
        const order = await db.order.findFirst({
          where: { providerOrderId, provider: "paypal" },
          include: { project: true },
        });

        if (order) {
          const expected = order.amount / 100;

          const actual = Number(capture?.amount?.value || 0);

          if (
            String(capture?.amount?.currency_code) === "USD" &&
            Math.abs(actual - expected) <= 0.0001
          ) {
            await finalizePaidOrder({
              orderId: order.id,
              provider: "paypal",
              providerPaymentId: String(capture.id),
              raw: event,
              providerAmount: actual,
              providerCurrency: "USD",
            });
          }
        }
      }
    }

    if (
      eventType === "PAYMENT.CAPTURE.DENIED" ||
      eventType === "CHECKOUT.PAYMENT-APPROVAL.REVERSED"
    ) {
      const providerOrderId =
        eventType === "PAYMENT.CAPTURE.DENIED"
          ? extractPayPalOrderIdFromCaptureWebhook(event)
          : String(event?.resource?.id || "");

      if (providerOrderId) {
        await db.order.updateMany({
          where: {
            providerOrderId,
            provider: "paypal",
            status: { not: "PAID" },
          },
          data: { status: "FAILED" },
        });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook failed:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default r;
