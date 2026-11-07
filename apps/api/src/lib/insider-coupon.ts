export const WHATSAPP_INSIDER_COUPON_CODE = "INSIDER10";
export const WHATSAPP_INSIDER_DISCOUNT_PERCENT = 10;

export class CouponValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponValidationError";
  }
}

export function normalizeCouponCode(code: unknown): string | null {
  if (code === undefined || code === null || code === "") return null;
  if (typeof code !== "string") {
    throw new CouponValidationError("Enter a valid coupon code.");
  }

  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized !== WHATSAPP_INSIDER_COUPON_CODE) {
    throw new CouponValidationError("This coupon code is not valid.");
  }
  return normalized;
}

export function calculateCouponAmounts(
  originalAmountMinor: number,
  couponCode: string | null,
) {
  if (!Number.isSafeInteger(originalAmountMinor) || originalAmountMinor <= 0) {
    throw new Error("Coupon pricing requires a positive integer minor-unit amount.");
  }

  if (!couponCode) {
    return {
      originalAmountMinor,
      discountAmountMinor: 0,
      finalAmountMinor: originalAmountMinor,
      couponCode: null,
    };
  }

  if (couponCode !== WHATSAPP_INSIDER_COUPON_CODE) {
    throw new CouponValidationError("This coupon code is not valid.");
  }

  // Round half up to the nearest paise/cent, keeping all accounting in minor units.
  const discountAmountMinor = Math.floor(
    (originalAmountMinor * WHATSAPP_INSIDER_DISCOUNT_PERCENT + 50) / 100,
  );
  const finalAmountMinor = originalAmountMinor - discountAmountMinor;
  if (discountAmountMinor <= 0 || finalAmountMinor <= 0) {
    throw new CouponValidationError("This order is not eligible for the coupon.");
  }

  return {
    originalAmountMinor,
    discountAmountMinor,
    finalAmountMinor,
    couponCode,
  };
}

export const ACTIVE_COUPON_ORDER_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;

export function canReuseCouponReservation(
  order: {
    status: string;
    projectId: string;
    currency: string;
    amount: number;
    originalAmount: number | null;
    discountAmount: number;
    provider?: string;
    planId?: string;
  } | null,
  expected: {
    projectId: string;
    currency: "INR" | "USD";
    finalAmountMinor: number;
    originalAmountMinor: number;
    discountAmountMinor: number;
    provider?: "razorpay" | "paypal";
    planId?: string;
  },
) {
  if (!order) return true;
  return order.status === "PENDING" &&
    order.projectId === expected.projectId &&
    order.currency === expected.currency &&
    order.amount === expected.finalAmountMinor &&
    order.originalAmount === expected.originalAmountMinor &&
    order.discountAmount === expected.discountAmountMinor &&
    (!expected.provider || order.provider === expected.provider) &&
    (!expected.planId || order.planId === expected.planId);
}
