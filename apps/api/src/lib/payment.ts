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

  // Capture policy is configured in Razorpay Dashboard. The verification
  // flow explicitly captures an authorized payment when automatic capture
  // has not completed yet.
  return client.orders.create({
    amount: amountMinor,
    currency: "INR",
    receipt: receipt.slice(0, 40),
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

export async function captureRazorpayPaymentIfAuthorized(
  providerPaymentId: string,
  providerOrderId: string,
  expectedAmount: number,
) {
  const payment = await fetchRazorpayPayment(providerPaymentId);

  if (
    String(payment?.order_id) !== providerOrderId ||
    Number(payment?.amount) !== expectedAmount ||
    String(payment?.currency) !== "INR"
  ) {
    throw new Error("Razorpay payment does not match the order");
  }

  if (payment.status !== "authorized") {
    return payment;
  }

  try {
    return await requireRazorpay().payments.capture(
      providerPaymentId,
      expectedAmount,
      "INR",
    );
  } catch (captureError) {
    // The customer callback and webhook can race to capture the same payment.
    // Accept the race only when Razorpay confirms it has already been captured.
    const refreshed = await fetchRazorpayPayment(providerPaymentId);
    if (refreshed?.status === "captured") {
      return refreshed;
    }

    throw captureError;
  }
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

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
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

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
