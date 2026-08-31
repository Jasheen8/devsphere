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

/* =========================================================
   CREATE RAZORPAY ORDER
   ========================================================= */

r.post(
  "/create-order",
  auth,
  async (req, res) => {
    const parsed = z
      .object({
        projectId: z.string(),
        planId: z.string(),

        // Selected BEFORE payment
        revealMethod: z
          .enum([
            "NORMAL",
            "QR",
            "PIN",
            "LETTER",
            "GIFT",
            "PUZZLE",
          ])
          .default("NORMAL"),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid order",
      });
    }

    const u = (req as any).user;

    const [project, plan] =
      await Promise.all([
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

    if (
      !project ||
      !plan ||
      !plan.active
    ) {
      return res.status(404).json({
        error:
          "Project or plan not found",
      });
    }

    if (
      project.status !== "FINALIZED"
    ) {
      return res.status(409).json({
        error:
          "Finalize the project first",
      });
    }

    /*
     * =====================================================
     * BIRTHDAY PRICING
     * =====================================================
     *
     * NORMAL + no movie  = ₹99
     * NORMAL + movie     = ₹109
     * special reveal     = ₹119
     */

    const projectData =
      (project as any).data || {};

    const movieEnabled =
      projectData.movieEnabled === true;

    const revealMethod =
      parsed.data.revealMethod;

    const specialRevealMethods = [
      "QR",
      "PIN",
      "LETTER",
      "GIFT",
      "PUZZLE",
    ];

    const specialReveal =
      specialRevealMethods.includes(
        revealMethod,
      );

    let finalPrice = 99;

    if (specialReveal) {
      finalPrice = 119;
    } else if (movieEnabled) {
      finalPrice = 109;
    }

    /*
     * =====================================================
     * SAVE SELECTED REVEAL METHOD
     * =====================================================
     *
     * This keeps the selected method available to the
     * publishing flow. This assumes your project data JSON
     * is where template-specific configuration belongs.
     */

    const updatedProjectData = {
  ...projectData,

  method: parsed.data.revealMethod,

  scannerStyle:
    parsed.data.revealMethod === "QR"
      ? parsed.data.scannerStyle || "HEART"
      : null,
};

    await db.project.update({
      where: {
        id: project.id,
      },

      data: {
        data: updatedProjectData,
      },
    });

    /*
     * =====================================================
     * SAVE ORDER
     * =====================================================
     */

    const order =
      await db.order.create({
        data: {
          userId: u.id,

          projectId:
            project.id,

          planId:
            plan.id,

          amount:
            finalPrice,

          currency:
            plan.currency,
        },
      });

    /*
     * =====================================================
     * RAZORPAY
     * =====================================================
     */

    const rp =
      await createRazorpayOrder(
        finalPrice * 100,
        order.id,
      );

    await db.order.update({
      where: {
        id: order.id,
      },

      data: {
        providerOrderId:
          rp.id,
      },
    });

    return res.status(201).json({
      orderId:
        order.id,

      providerOrderId:
        rp.id,

      amount:
        finalPrice * 100,

      currency:
        plan.currency,

      keyId:
        process.env
          .RAZORPAY_KEY_ID || "",

      revealMethod,

      price: finalPrice,
    });
  },
);


/* =========================================================
   VERIFY PAYMENT
   ========================================================= */

r.post(
  "/verify",
  auth,
  async (req, res) => {
    const p = z
      .object({
        orderId: z.string(),
        razorpayOrderId: z.string(),
        razorpayPaymentId: z.string(),
        razorpaySignature: z.string(),
      })
      .safeParse(req.body);

    if (!p.success) {
      return res.status(400).json({
        error: "Invalid payment",
      });
    }

    const u = (req as any).user;

    const order =
      await db.order.findFirst({
        where: {
          id: p.data.orderId,
          userId: u.id,
        },
      });

    if (
      !order ||
      order.providerOrderId !==
        p.data.razorpayOrderId
    ) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (
      !verifyPaymentSignature(
        p.data.razorpayOrderId,
        p.data.razorpayPaymentId,
        p.data.razorpaySignature,
      )
    ) {
      return res.status(400).json({
        error:
          "Signature verification failed",
      });
    }

    const already =
      await db.payment.findFirst({
        where: {
          providerPaymentId:
            p.data.razorpayPaymentId,
        },
      });

    if (
      already ||
      order.status === "PAID"
    ) {
      return res.json({
        ok: true,
      });
    }

    await db.$transaction([
      db.payment.create({
        data: {
          orderId:
            order.id,

          provider:
            "razorpay",

          status:
            "CAPTURED",

          amount:
            order.amount,

          currency:
            order.currency,

          providerPaymentId:
            p.data
              .razorpayPaymentId,

          signature:
            p.data
              .razorpaySignature,
        },
      }),

      db.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: "PAID",

          providerPaymentId:
            p.data
              .razorpayPaymentId,
        },
      }),
    ]);

    return res.json({
      ok: true,
    });
  },
);


/* =========================================================
   RAZORPAY WEBHOOK
   ========================================================= */

r.post(
  "/webhook",
  async (req, res) => {
    const sig = String(
      req.headers[
        "x-razorpay-signature"
      ] || "",
    );

    const raw = Buffer.isBuffer(
      req.body,
    )
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);

    if (
      !verifyWebhookSignature(
        raw,
        sig,
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid webhook signature",
      });
    }

    const parsed =
      Buffer.isBuffer(req.body)
        ? JSON.parse(raw)
        : req.body;

    const event =
      parsed?.event;

    const payment =
      parsed?.payload
        ?.payment
        ?.entity;

    if (payment?.order_id) {
      const order =
        await db.order.findFirst({
          where: {
            providerOrderId:
              payment.order_id,
          },
        });

      if (order) {
        const isCaptured =
          event ===
          "payment.captured";

        await db.order.update({
          where: {
            id: order.id,
          },

          data: {
            status:
              isCaptured
                ? "PAID"
                : "FAILED",

            providerPaymentId:
              payment.id,
          },
        });

        await db.payment.upsert({
          where: {
            id:
              `webhook-${payment.id}`,
          },

          update: {
            status:
              isCaptured
                ? "CAPTURED"
                : "FAILED",
          },

          create: {
            id:
              `webhook-${payment.id}`,

            orderId:
              order.id,

            provider:
              "razorpay",

            status:
              isCaptured
                ? "CAPTURED"
                : "FAILED",

            amount:
              order.amount,

            currency:
              order.currency,

            providerPaymentId:
              payment.id,

            raw:
              parsed,
          },
        });
      }
    }

    return res.json({
      received: true,
    });
  },
);

export default r;