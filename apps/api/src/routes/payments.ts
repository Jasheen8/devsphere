import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
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
  getPayPalOrder,
  verifyPayPalWebhook,
} from "../lib/paypal.js";
import {
  calculateBirthdayPackage,
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
  res.json({
    paypalClientId: getPayPalClientId(),
    paypalEnabled: Boolean(getPayPalClientId()),
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

  try {
    if (await failIfPaid(data.projectId, user.id, res)) {
      return;
    }

    const [project, plan] = await Promise.all([
      db.project.findFirst({
        where: { id: data.projectId, userId: user.id },
      }),
      db.pricingPlan.findUnique({ where: { id: data.planId } }),
    ]);

    if (!project || !plan || !plan.active) {
      return res.status(404).json({ error: "Project or plan not found" });
    }

    if (project.status !== "FINALIZED") {
      return res.status(409).json({ error: "Finalize the project first" });
    }

    if (data.currency === "USD" && !getPayPalClientId()) {
      return res
        .status(503)
        .json({ error: "International payments are not configured yet" });
    }

    const projectData = (project.data as Record<string, unknown> | null) || {};

    const pricing = calculateBirthdayPackage({
      projectData,
      revealMethod: data.revealMethod,
      currency: data.currency,
    });

    const updatedData = {
      ...projectData,
      packagePrice: pricing.packagePrice,
      packageCurrency: data.currency,
      packageProvider: data.currency === "USD" ? "paypal" : "razorpay",
      packageProviderAmount: pricing.providerAmount,
      scannerStyle:
        data.revealMethod === "QR" ? data.scannerStyle || "HEART" : null,
    };

    await db.project.update({
      where: { id: project.id },
      data: {
        revealMethod: data.revealMethod,
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
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPending?.providerOrderId) {
      return res.status(200).json({
        orderId: existingPending.id,
        provider: existingPending.provider,
        providerOrderId: existingPending.providerOrderId,
        amount:
          data.currency === "USD"
            ? existingPending.amount / 100
            : existingPending.amount,
        currency: existingPending.currency,
        ...(provider === "razorpay"
          ? { keyId: process.env.RAZORPAY_KEY_ID || "" }
          : { clientId: getPayPalClientId() }),
      });
    }

    await db.project.update({
      where: { id: project.id },
      data: {
        revealMethod: data.revealMethod,
        data: updatedData,
      },
    });

    const order = await db.order.create({
      data: {
        userId: user.id,
        projectId: project.id,
        planId: plan.id,
        amount: pricing.providerAmountMinor,
        currency: data.currency,
        provider,
      },
    });

    createdOrderId = order.id;

    if (provider === "razorpay") {
      const razorpayOrder = await createRazorpayOrder(
        pricing.providerAmountMinor,
        order.id,
      );

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

    const paypalOrder = await createPayPalOrder({
      amountUsd: pricing.providerAmount,
      referenceId: order.id,
      description: `Devsphere Birthday Website - ${
        pricing.specialReveal
          ? "Special Reveal"
          : pricing.movieEnabled
            ? "Our Movie"
            : "Basic"
      }`,
    });

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

    return res.status(500).json({
      error: "Unable to start payment",
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

    const providerPayment = await fetchRazorpayPayment(data.razorpayPaymentId);

    const expectedAmount = order.amount;

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

    const pendingOrders = project.orders.filter(
      (item) => item.status === "PENDING" && item.providerOrderId,
    );

    for (const order of pendingOrders) {
      if (order.provider === "razorpay" && order.providerOrderId) {
        try {
          const payments = await fetchRazorpayPayments(order.providerOrderId);
          const captured = payments?.items?.find(
            (item: any) =>
              item?.status === "captured" &&
              item?.order_id === order.providerOrderId,
          );

          const expectedAmount = order.amount;

          if (
            captured &&
            Number(captured.amount) === expectedAmount &&
            String(captured.currency) === "INR"
          ) {
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

    if (event?.event === "payment.captured") {
      const expectedAmount = order.amount;
      if (
        String(payment.status) === "captured" &&
        Number(payment.amount) === expectedAmount &&
        String(payment.currency) === "INR"
      ) {
        await finalizePaidOrder({
          orderId: order.id,
          provider: "razorpay",
          providerPaymentId: payment.id,
          raw: event,
          providerAmount: Number(payment.amount) / 100,
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
