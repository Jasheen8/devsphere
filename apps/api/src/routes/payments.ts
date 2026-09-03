import { Router } from "express";
import { z } from "zod";

import { db } from "../lib/db.js";
import { auth } from "../lib/auth.js";

import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../lib/payment.js";

const r = Router();

const revealMethodSchema = z.enum([
  "NORMAL",
  "QR",
  "PIN",
  "LETTER",
  "GIFT",
  "PUZZLE",
]);

const scannerStyleSchema = z.enum(["HEART", "SQUARE"]);

/* =========================================================
   CREATE RAZORPAY ORDER
   ========================================================= */

r.post("/create-order", auth, async (req, res) => {
  const parsed = z
    .object({
      projectId: z.string(),
      planId: z.string(),

      revealMethod: revealMethodSchema.default("NORMAL"),

      scannerStyle: scannerStyleSchema.nullable().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid order",
    });
  }

  const u = (req as any).user;

  const [project, plan] = await Promise.all([
    db.project.findFirst({
      where: {
        id: parsed.data.projectId,
        userId: u.id,
      },
    }),

    db.pricingPlan.findUnique({
      where: {
        id: parsed.data.planId,
      },
    }),
  ]);

  if (!project || !plan || !plan.active) {
    return res.status(404).json({
      error: "Project or plan not found",
    });
  }

  if (project.status !== "FINALIZED") {
    return res.status(409).json({
      error: "Finalize the project first",
    });
  }

  /* =======================================================
     BIRTHDAY PRICING
     ======================================================= */

  const projectData = (project as any).data || {};

  const movieEnabled = projectData.movieEnabled === true;

  const revealMethod = String(parsed.data.revealMethod || "NORMAL")
    .trim()
    .toUpperCase();

  const specialRevealMethods = ["QR", "PIN", "LETTER", "GIFT", "PUZZLE"];

  let finalPrice = 99;

  if (specialRevealMethods.includes(revealMethod)) {
    finalPrice = 119;
  } else if (movieEnabled) {
    finalPrice = 109;
  }

  /* =======================================================
     SAVE SELECTED REVEAL / SCANNER STYLE
     ======================================================= */

  const existingData =
    projectData && typeof projectData === "object" ? projectData : {};

  const updatedProjectData = {
    ...existingData,

    method: revealMethod,

    scannerStyle:
      revealMethod === "QR" ? parsed.data.scannerStyle || "HEART" : null,
  };

  await db.project.update({
    where: {
      id: project.id,
    },

    data: {
      revealMethod: revealMethod as any,

      data: updatedProjectData as any,
    },
  });

  /* =======================================================
     CREATE DATABASE ORDER
     ======================================================= */

  const order = await db.order.create({
    data: {
      userId: u.id,
      projectId: project.id,
      planId: plan.id,
      amount: finalPrice,
      currency: plan.currency,
    },
  });

  /* =======================================================
     CREATE RAZORPAY ORDER
     ======================================================= */

  const rp = await createRazorpayOrder(finalPrice * 100, order.id);

  await db.order.update({
    where: {
      id: order.id,
    },

    data: {
      providerOrderId: rp.id,
    },
  });

  return res.status(201).json({
    orderId: order.id,
    providerOrderId: rp.id,
    amount: finalPrice * 100,
    currency: plan.currency,
    keyId: process.env.RAZORPAY_KEY_ID || "",
  });
});

/* =========================================================
   VERIFY PAYMENT
   ========================================================= */

r.post("/verify", auth, async (req, res) => {
  const parsed = z
    .object({
      orderId: z.string(),
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payment",
    });
  }

  const u = (req as any).user;

  const order = await db.order.findFirst({
    where: {
      id: parsed.data.orderId,
      userId: u.id,
    },
  });

  if (!order || order.providerOrderId !== parsed.data.razorpayOrderId) {
    return res.status(404).json({
      error: "Order not found",
    });
  }

  if (
    !verifyPaymentSignature(
      parsed.data.razorpayOrderId,
      parsed.data.razorpayPaymentId,
      parsed.data.razorpaySignature,
    )
  ) {
    return res.status(400).json({
      error: "Signature verification failed",
    });
  }

  const already = await db.payment.findFirst({
    where: {
      providerPaymentId: parsed.data.razorpayPaymentId,
    },
  });

  if (already || order.status === "PAID") {
    return res.json({
      ok: true,
    });
  }

  await db.$transaction([
    db.payment.create({
      data: {
        orderId: order.id,
        provider: "razorpay",
        status: "CAPTURED",
        amount: order.amount,
        currency: order.currency,
        providerPaymentId: parsed.data.razorpayPaymentId,
        signature: parsed.data.razorpaySignature,
      },
    }),

    db.order.update({
      where: {
        id: order.id,
      },

      data: {
        status: "PAID",
        providerPaymentId: parsed.data.razorpayPaymentId,
      },
    }),
  ]);

  return res.json({
    ok: true,
  });
});

/* =========================================================
   RAZORPAY WEBHOOK
   ========================================================= */

r.post("/webhook", async (req, res) => {
  const sig = String(req.headers["x-razorpay-signature"] || "");

  const raw = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : JSON.stringify(req.body);

  if (!verifyWebhookSignature(raw, sig)) {
    return res.status(400).json({
      error: "Invalid webhook signature",
    });
  }

  const parsed = Buffer.isBuffer(req.body) ? JSON.parse(raw) : req.body;

  const event = parsed?.event;
  const payment = parsed?.payload?.payment?.entity;

  if (payment?.order_id) {
    const order = await db.order.findFirst({
      where: {
        providerOrderId: payment.order_id,
      },
    });

    if (order) {
      const isCaptured = event === "payment.captured" || event === "order.paid";

      const isFailed = event === "payment.failed";
      await db.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: isCaptured ? "PAID" : isFailed ? "FAILED" : order.status,
          providerPaymentId: payment.id,
        },
      });

      await db.payment.upsert({
        where: {
          id: `webhook-${payment.id}`,
        },

        update: {
          status: isCaptured ? "CAPTURED" : isFailed ? "FAILED" : "CREATED",
        },

        create: {
          id: `webhook-${payment.id}`,

          orderId: order.id,

          provider: "razorpay",

          status: isCaptured ? "CAPTURED" : "FAILED",

          amount: order.amount,

          currency: order.currency,

          providerPaymentId: payment.id,

          raw: parsed,
        },
      });
    }
  }

  return res.json({
    received: true,
  });
});

export default r;
