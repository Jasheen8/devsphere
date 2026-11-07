import { describe, expect, it } from "vitest";
import {
  canReuseCouponReservation,
  calculateCouponAmounts,
  CouponValidationError,
  normalizeCouponCode,
} from "../lib/insider-coupon.js";
import { calculateTemplatePackagePricing } from "../lib/fulfillment.js";

describe("WhatsApp Insider coupon", () => {
  it("normalizes the code and applies exactly one discount", () => {
    const code = normalizeCouponCode("  insider10 ");
    expect(code).toBe("INSIDER10");
    expect(calculateCouponAmounts(9_900, code)).toEqual({
      originalAmountMinor: 9_900,
      discountAmountMinor: 990,
      finalAmountMinor: 8_910,
      couponCode: "INSIDER10",
    });
  });

  it.each([
    { amountMinor: 1_000, expectedDiscountMinor: 100 },
    { amountMinor: 5_500, expectedDiscountMinor: 550 },
    { amountMinor: 11_900, expectedDiscountMinor: 1_190 },
    { amountMinor: 9_999, expectedDiscountMinor: 1_000 },
  ])("rounds to the nearest cent/paise in minor units", ({ amountMinor, expectedDiscountMinor }) => {
    const quote = calculateCouponAmounts(amountMinor, "INSIDER10");
    expect(quote.discountAmountMinor).toBe(expectedDiscountMinor);
    expect(quote.finalAmountMinor).toBe(amountMinor - expectedDiscountMinor);
  });

  it("leaves the server price unchanged when no coupon is supplied", () => {
    expect(calculateCouponAmounts(5_000, null)).toEqual({
      originalAmountMinor: 5_000,
      discountAmountMinor: 0,
      finalAmountMinor: 5_000,
      couponCode: null,
    });
  });

  it("rejects invalid codes instead of combining discounts", () => {
    expect(() => normalizeCouponCode("INSIDER10 + OTHER"))
      .toThrow(CouponValidationError);
  });

  it("uses the current server-calculated USD package price as its discount base", () => {
    const packagePrice = calculateTemplatePackagePricing({
      templateSlug: "anniversary-romantic-01",
      projectData: { movieEnabled: true },
      currency: "USD",
      revealMethod: "QR",
    });
    const couponPrice = calculateCouponAmounts(
      packagePrice.providerAmountMinor,
      "INSIDER10",
    );

    expect(packagePrice.providerAmountMinor).toBe(3_000);
    expect(couponPrice.discountAmountMinor).toBe(300);
    expect(couponPrice.finalAmountMinor).toBe(2_700);
  });

  it("allows an exact pending checkout to be resumed, but prevents a second redemption", () => {
    const activeOrder = {
      status: "PENDING",
      projectId: "project-1",
      currency: "INR",
      amount: 8_910,
      originalAmount: 9_900,
      discountAmount: 990,
      provider: "razorpay",
      planId: "basic-plan",
    };
    const expected = {
      projectId: "project-1",
      currency: "INR" as const,
      finalAmountMinor: 8_910,
      originalAmountMinor: 9_900,
      discountAmountMinor: 990,
      provider: "razorpay" as const,
      planId: "basic-plan",
    };

    expect(canReuseCouponReservation(activeOrder, expected)).toBe(true);
    expect(canReuseCouponReservation(activeOrder, {
      ...expected,
      projectId: "project-2",
    })).toBe(false);
    expect(canReuseCouponReservation({ ...activeOrder, status: "PAID" }, expected)).toBe(false);
  });

  it("keeps the package-plus-options total as the discount base in INR", () => {
    const packagePrice = calculateTemplatePackagePricing({
      templateSlug: "birthday-royal-memory",
      projectData: { movieEnabled: false },
      currency: "INR",
      revealMethod: "QR",
    });
    const couponPrice = calculateCouponAmounts(
      packagePrice.providerAmountMinor,
      "INSIDER10",
    );

    expect(packagePrice.providerAmountMinor).toBe(11_900);
    expect(couponPrice.discountAmountMinor).toBe(1_190);
    expect(couponPrice.finalAmountMinor).toBe(10_710);
  });
});
