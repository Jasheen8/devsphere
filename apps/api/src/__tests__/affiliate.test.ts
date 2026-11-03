import { describe, expect, it, vi } from "vitest";
import {
  calculateCommissionMinor,
  recordVerifiedAffiliateConversion,
  signAffiliateAttribution,
  verifyAffiliateAttribution,
} from "../lib/affiliate.js";

describe("affiliate attribution tokens", () => {
  it("accepts a valid signed click and rejects tampered or expired payloads", () => {
    const expiresAt = Date.now() + 60_000;
    const token = signAffiliateAttribution({ clickId: "click-1", expiresAt });

    expect(verifyAffiliateAttribution(token)?.clickId).toBe("click-1");
    expect(verifyAffiliateAttribution(`${token}x`)).toBeNull();
    expect(verifyAffiliateAttribution(token, expiresAt)).toBeNull();
  });
});

describe("affiliate commission arithmetic", () => {
  it("uses integer minor units with half-up rounding", () => {
    expect(calculateCommissionMinor(25_050, 2_000)).toBe(5_010);
    expect(calculateCommissionMinor(1, 5_000)).toBe(1);
    expect(calculateCommissionMinor(99, 0)).toBe(0);
    expect(() => calculateCommissionMinor(0, 2_000)).toThrow();
    expect(() => calculateCommissionMinor(100, 10_001)).toThrow();
  });
});

describe("verified affiliate conversion recording", () => {
  it("creates one conversion, pending commission and ledger credit for a paid order", async () => {
    const orderIds = new Set<string>();
    const conversions: any[] = [];
    const commissions: any[] = [];
    const entries: any[] = [];
    const tx = {
      affiliateConversion: {
        createMany: vi.fn(async ({ data }: any) => {
          if (orderIds.has(data[0].orderId)) return { count: 0 };
          orderIds.add(data[0].orderId);
          conversions.push(...data);
          return { count: 1 };
        }),
      },
      affiliateCommission: {
        create: vi.fn(async ({ data }: any) => commissions.push(data)),
      },
      affiliateLedgerEntry: {
        create: vi.fn(async ({ data }: any) => entries.push(data)),
      },
    };
    const order = {
      id: "order-1",
      amount: 25_050,
      currency: "INR",
      affiliateAttribution: {
        id: "attribution-1",
        affiliateProfileId: "affiliate-1",
        referralLinkId: "link-1",
        offerId: "offer-1",
        commissionBps: 2_000,
        offerVersion: 3,
        policyVersion: 2,
        expiresAt: new Date(Date.now() + 60_000),
      },
    };

    expect(await recordVerifiedAffiliateConversion(tx, {
      order,
      paymentId: "razorpay-payment-row-1",
      verifiedPaymentId: "pay_provider_1",
    })).toBe(true);
    expect(await recordVerifiedAffiliateConversion(tx, {
      order,
      paymentId: "razorpay-payment-row-1",
      verifiedPaymentId: "pay_provider_1",
    })).toBe(false);

    expect(conversions).toHaveLength(1);
    expect(conversions[0]).toMatchObject({
      orderId: "order-1",
      currency: "INR",
      eligibleAmountMinor: 25_050,
      verifiedPaymentId: "pay_provider_1",
    });
    expect(commissions).toHaveLength(1);
    expect(commissions[0]).toMatchObject({
      commissionBps: 2_000,
      commissionAmountMinor: 5_010,
      offerVersion: 3,
      policyVersion: 2,
      status: "PENDING",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: "COMMISSION_PENDING_CREDIT",
      amountMinor: 5_010,
      currency: "INR",
      idempotencyKey: "affiliate-pending-commission:order-1",
    });
  });

  it("does not write a conversion when an order has no eligible attribution", async () => {
    const tx = {
      affiliateConversion: { createMany: vi.fn() },
      affiliateCommission: { create: vi.fn() },
      affiliateLedgerEntry: { create: vi.fn() },
    };
    expect(await recordVerifiedAffiliateConversion(tx, {
      order: { id: "order-unattributed", amount: 2_000, currency: "USD", affiliateAttribution: null },
      paymentId: "payment-row",
      verifiedPaymentId: "provider-payment",
    })).toBe(false);
    expect(tx.affiliateConversion.createMany).not.toHaveBeenCalled();
    expect(tx.affiliateCommission.create).not.toHaveBeenCalled();
    expect(tx.affiliateLedgerEntry.create).not.toHaveBeenCalled();
  });

  it("does not convert an order paid after its attribution window expires", async () => {
    const tx = {
      affiliateConversion: { createMany: vi.fn() },
      affiliateCommission: { create: vi.fn() },
      affiliateLedgerEntry: { create: vi.fn() },
    };
    const convertedAt = new Date("2026-10-31T12:00:00Z");
    expect(await recordVerifiedAffiliateConversion(tx, {
      order: {
        id: "order-expired",
        amount: 2_000,
        currency: "INR",
        affiliateAttribution: {
          id: "attribution-expired",
          affiliateProfileId: "affiliate-1",
          referralLinkId: "link-1",
          offerId: "offer-1",
          commissionBps: 2_000,
          offerVersion: 1,
          policyVersion: 1,
          expiresAt: new Date(convertedAt.getTime() - 1),
        },
      },
      paymentId: "payment-row",
      verifiedPaymentId: "provider-payment",
      now: convertedAt,
    })).toBe(false);
    expect(tx.affiliateConversion.createMany).not.toHaveBeenCalled();
  });
});
