import { Router } from "express";
import { z } from "zod";
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
  calculateBirthdayPackage,
  calculateBloomAnniversaryPackage,
  calculateNavratriPartnerInvitePackage,
  calculateWeddingInvitationPackage,
  finalizePaidOrder,
  publishPaidProject,
} from "../lib/fulfillment.js";

const r = Router();

const checkoutSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  currency: z.enum(["INR", "USD"]).default("INR"),
  revealMethod: z
    .enum(["NORMAL", "QR", "PIN", "LETTER", "GIFT", "PUZZLE"])
    .default("NORMAL"),
  scannerStyle: z.enum(["HEART", "SQUARE"]).nullable().optional(),
});

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

    if (project.status !== "FINALIZED") {
      return res.status(409).json({ error: "Finalize the project first" });
    }

    const isBloomAnniversary =
      project.template.slug === "anniversary-romantic-01";
    const isNavratri =
      project.template.slug === "navratri-partner-invite";
    const isWeddingInvitation =
      project.template.slug === "wedding-invitation";
    const checkoutRevealMethod = isNavratri ? "NORMAL" : data.revealMethod;

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
      ].includes(project.template.slug) &&
      projectCustomization.removeWatermark === true;

    const pricing = isWeddingInvitation
      ? calculateWeddingInvitationPackage({
          projectData,
          revealMethod: checkoutRevealMethod,
          currency: data.currency,
        })
      : isNavratri
      ? calculateNavratriPartnerInvitePackage({
          currency: data.currency,
          removeWatermark,
        })
      : isBloomAnniversary
      ? calculateBloomAnniversaryPackage({
          projectData,
          revealMethod: checkoutRevealMethod,
          currency: data.currency,
          removeWatermark,
        })
      : calculateBirthdayPackage({
          projectData,
          revealMethod: checkoutRevealMethod,
          currency: data.currency,
          removeWatermark,
        });

    const updatedData = {
      ...projectData,
      packageBasePrice: pricing.basePackagePrice,
      packagePrice: pricing.packagePrice,
      removeWatermark: pricing.removeWatermark,
      packageCurrency: data.currency,
      packageProvider: data.currency === "USD" ? "paypal" : "razorpay",
      packageProviderAmount: pricing.providerAmount,
      scannerStyle:
        checkoutRevealMethod === "QR" ? data.scannerStyle || "HEART" : null,
    };

    await db.project.update({
      where: { id: project.id },
      data: {
        revealMethod: checkoutRevealMethod,
        data: updatedData,
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
        amount: pricing.providerAmountMinor,
        currency: data.currency,
        removeWatermark: pricing.removeWatermark,
      },
      orderBy: { createdAt: "desc" },
    });

    // Reuse pending orders only for PayPal.
    // For Razorpay, always create a fresh provider order.
    if (existingPending?.providerOrderId && provider === "paypal") {
      return res.status(200).json({
        orderId: existingPending.id,
        provider: existingPending.provider,
        providerOrderId: existingPending.providerOrderId,
        amount: existingPending.amount / 100,
        currency: existingPending.currency,
        clientId: getPayPalClientId(),
      });
    }

    const order = await db.order.create({
      data: {
        userId: user.id,
        projectId: project.id,
        planId: plan.id,
        amount: pricing.providerAmountMinor,
        currency: data.currency,
        provider,
        removeWatermark: pricing.removeWatermark,
      },
    });

    createdOrderId = order.id;

    if (provider === "razorpay") {
      providerRequestInFlight = true;
      const razorpayOrder = await createRazorpayOrder(
        pricing.providerAmountMinor,
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
        amount: pricing.providerAmountMinor,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID || "",
      });
    }

    providerRequestInFlight = true;
    const paypalOrder = await createPayPalOrder({
      amountUsd: pricing.providerAmount,
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
      amount: pricing.providerAmount,
      currency: "USD",
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
      return res.json({
        paid: true,
        url: `${process.env.APP_URL || "http://localhost:5173"}/r/${project.website.slug}`,
      });
    }

    const paidOrder = project.orders.find((item) => item.status === "PAID");

    if (paidOrder) {
      const published = await publishPaidProject(project.id, user.id);
      return res.json({ paid: true, url: published.url });
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

            return res.json({ paid: true, url: result.url });
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

            return res.json({ paid: true, url: result.url });
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
