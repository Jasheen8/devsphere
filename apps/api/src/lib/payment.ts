import Razorpay from "razorpay";
import crypto from "node:crypto";

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function requireRazorpay() {
  return getRazorpayClient();
}

export async function createRazorpayOrder(
  amountMinor: number,
  receipt: string,
) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid Razorpay amount");
  }

  const client = requireRazorpay();

  return client.orders.create({
    amount: amountMinor,
    currency: "INR",
    receipt: receipt.slice(0, 40),
    payment_capture: true,
  });
}

export async function fetchRazorpayOrder(providerOrderId: string) {
  if (!providerOrderId) {
    throw new Error("Razorpay order ID is required");
  }

  return requireRazorpay().orders.fetch(providerOrderId);
}

export async function fetchRazorpayPayments(providerOrderId: string) {
  if (!providerOrderId) {
    throw new Error("Razorpay order ID is required");
  }

  return requireRazorpay().orders.fetchPayments(providerOrderId);
}

export async function fetchRazorpayPayment(providerPaymentId: string) {
  if (!providerPaymentId) {
    throw new Error("Razorpay payment ID is required");
  }

  return requireRazorpay().payments.fetch(providerPaymentId);
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret || !orderId || !paymentId || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || !rawBody || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}