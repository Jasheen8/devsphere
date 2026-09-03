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

export async function createRazorpayOrder(
  amount: number,
  receipt: string,
) {
  if (!Number.isInteger(amount) || amount < 100) {
    throw new Error("Invalid Razorpay amount");
  }

  const client = getRazorpayClient();

  return client.orders.create({
    amount,
    currency: "INR",
    receipt,
    payment_capture: true,
  });
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    signatureBuffer,
  );
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    signatureBuffer,
  );
}