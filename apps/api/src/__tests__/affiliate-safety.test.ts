import { describe, expect, it, vi } from "vitest";
import { deleteUnpaidProject, ProjectDeletionError } from "../lib/project-deletion.js";
import { isProjectDeletionPaused } from "../lib/project-deletion-gate.js";
import { buildAffiliateAttributionSnapshot } from "../lib/affiliate-attribution.js";
import { AffiliatePaymentNotFoundError, paypalDisputeStatus, processAffiliatePaymentAdjustment } from "../lib/affiliate-payment-events.js";

function emptyProject() {
  return {
    id: "project-1",
    userId: "buyer-1",
    status: "DRAFT",
    website: null,
    orders: [],
  };
}

function deleteClient(project: any) {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    affiliateLedgerEntry: { findMany: vi.fn(async () => []) },
    project: { findFirst: vi.fn(async () => project), delete: vi.fn(async () => ({})) },
    affiliateAttribution: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    order: { deleteMany: vi.fn(async ({ where }: any) => ({ count: where.id.in.length })) },
    projectMedia: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    projectRevision: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  };
  const client = {
    $transaction: vi.fn(async (callback: any) => callback(tx)),
  };
  return { client, tx };
}

describe("unpaid project deletion protection", () => {
  it("pauses project deletion before database work when the migration-window switch is enabled", () => {
    expect(isProjectDeletionPaused("true")).toBe(true);
    expect(isProjectDeletionPaused(" TRUE ")).toBe(true);
    expect(isProjectDeletionPaused("false")).toBe(false);
    expect(isProjectDeletionPaused(undefined)).toBe(false);
  });

  it("deletes only unconverted attribution and keeps clicks and content cleanup in one serializable transaction", async () => {
    const project = {
      ...emptyProject(),
      orders: [{ id: "order-1", status: "PENDING", payments: [], affiliateAttribution: { conversion: null }, affiliateConversion: null, affiliateCommissions: [] }],
    };
    const { client, tx } = deleteClient(project);

    await expect(deleteUnpaidProject(client, project.id, project.userId)).resolves.toEqual({ ok: true });
    expect((client.$transaction as any).mock.calls[0][1]).toEqual({ isolationLevel: "Serializable" });
    expect(tx.affiliateAttribution.deleteMany).toHaveBeenCalledWith({
      where: { orderId: { in: ["order-1"] }, conversion: null },
    });
    expect(tx.project.delete).toHaveBeenCalledOnce();
    expect((tx as any).affiliateClick?.deleteMany).toBeUndefined();
  });

  it.each([
    ["captured payment", { payments: [{ id: "pay-1", status: "CAPTURED", providerPaymentId: "rzp-1" }] }],
    ["unverified payment record", { payments: [{ id: "pay-2", status: "FAILED", providerPaymentId: null }] }],
    ["conversion", { affiliateConversion: { id: "conversion-1" } }],
    ["commission and ledger", { affiliateCommissions: [{ id: "commission-1", ledgerEntries: [{ id: "entry-1" }] }] }],
  ])("blocks deletion when it would remove %s", async (_label, extra) => {
    const order = {
      id: "order-1",
      status: "PENDING",
      payments: [],
      affiliateAttribution: null,
      affiliateConversion: null,
      affiliateCommissions: [],
      ...extra,
    };
    const project = { ...emptyProject(), orders: [order] };
    const { client, tx } = deleteClient(project);

    await expect(deleteUnpaidProject(client, project.id, project.userId)).rejects.toBeInstanceOf(ProjectDeletionError);
    expect(tx.affiliateAttribution.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.deleteMany).not.toHaveBeenCalled();
    expect(tx.project.delete).not.toHaveBeenCalled();
  });

  it("blocks deletion when an order-referenced ledger entry exists without a commission relation", async () => {
    const project = {
      ...emptyProject(),
      orders: [{ id: "order-1", status: "PENDING", payments: [], affiliateAttribution: null, affiliateConversion: null, affiliateCommissions: [] }],
    };
    const { client, tx } = deleteClient(project);
    tx.affiliateLedgerEntry.findMany.mockResolvedValue([{ id: "orphan-ledger-entry" }] as any);

    await expect(deleteUnpaidProject(client, project.id, project.userId)).rejects.toBeInstanceOf(ProjectDeletionError);
    expect(tx.affiliateLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { reference: { in: ["order-1"] } },
      select: { id: true },
      take: 1,
    });
    expect(tx.affiliateAttribution.deleteMany).not.toHaveBeenCalled();
    expect(tx.order.deleteMany).not.toHaveBeenCalled();
  });

  it("keeps published and paid project business rules", async () => {
    const published = deleteClient({ ...emptyProject(), website: { id: "site-1" } });
    await expect(deleteUnpaidProject(published.client, "project-1", "buyer-1")).rejects.toMatchObject({ statusCode: 403 });

    const paid = deleteClient({ ...emptyProject(), orders: [{ id: "order-paid", status: "PAID", payments: [], affiliateAttribution: null, affiliateConversion: null, affiliateCommissions: [] }] });
    await expect(deleteUnpaidProject(paid.client, "project-1", "buyer-1")).rejects.toMatchObject({ statusCode: 403 });
    expect(paid.tx.project.delete).not.toHaveBeenCalled();
  });
});

describe("checkout attribution eligibility", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");
  const click = {
    id: "click-1",
    affiliateProfileId: "affiliate-profile-1",
    referralLinkId: "link-1",
    clickedAt: new Date(now.getTime() - 1000),
    expiresAt: new Date(now.getTime() + 1000),
    affiliateProfile: { userId: "affiliate-user", status: "APPROVED" },
    referralLink: {
      active: true,
      offerId: "offer-1",
      offer: {
        status: "ACTIVE",
        startsAt: new Date(now.getTime() - 10_000),
        endsAt: null,
        commissionBps: 2000,
        version: 4,
        template: { id: "template-1", published: true, isFree: false },
      },
    },
  };
  const policy = { enabled: true, version: 7 };

  it("builds a snapshot for the last valid click and rejects self-referral and expired clicks", () => {
    expect(buildAffiliateAttributionSnapshot(click, policy, "buyer-user", "template-1", now)).toMatchObject({
      clickId: "click-1",
      offerVersion: 4,
      policyVersion: 7,
    });
    expect(buildAffiliateAttributionSnapshot(click, policy, "affiliate-user", "template-1", now)).toBeNull();
    expect(buildAffiliateAttributionSnapshot({ ...click, expiresAt: now }, policy, "buyer-user", "template-1", now)).toBeNull();
  });
});

function adjustmentClient() {
  const payment = { id: "payment-row", orderId: "order-1", provider: "razorpay", providerPaymentId: "pay-1", amount: 10_000, currency: "INR", status: "CAPTURED" };
  const commission = { id: "commission-1", affiliateProfileId: "affiliate-1", commissionAmountMinor: 2_000, eligibleAmountMinor: 10_000, reversedAmountMinor: 0, currency: "INR", status: "PENDING", statusBeforeDispute: null };
  const events = new Set<string>();
  const adjustments: any[] = [];
  const ledger: any[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => []),
    payment: {
      findFirst: vi.fn(async () => ({ id: payment.id, orderId: payment.orderId })),
      findUnique: vi.fn(async () => ({ ...payment, order: { id: payment.orderId } })),
      update: vi.fn(async ({ data }: any) => Object.assign(payment, data)),
    },
    affiliatePaymentWebhookEvent: {
      createMany: vi.fn(async ({ data }: any) => {
        const key = `${data[0].provider}:${data[0].eventId}`;
        if (events.has(key)) return { count: 0 };
        events.add(key);
        return { count: 1 };
      }),
    },
    affiliatePaymentAdjustment: {
      findUnique: vi.fn(async ({ where }: any) => adjustments.find((row) => row.provider === where.provider_kind_externalId.provider && row.kind === where.provider_kind_externalId.kind && row.externalId === where.provider_kind_externalId.externalId) || null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = where.provider_kind_externalId;
        let row = adjustments.find((item) => item.provider === key.provider && item.kind === key.kind && item.externalId === key.externalId);
        if (row) Object.assign(row, update);
        else { row = { ...create }; adjustments.push(row); }
        return row;
      }),
      findMany: vi.fn(async ({ where }: any) => adjustments.filter((row) => row.paymentId === where.paymentId && (!where.kind || row.kind === where.kind) && (!where.status || row.status === where.status))),
    },
    affiliateConversion: { findUnique: vi.fn(async () => ({ commission: { ...commission } })) },
    affiliateCommission: { update: vi.fn(async ({ data }: any) => Object.assign(commission, data)) },
    affiliateLedgerEntry: { create: vi.fn(async ({ data }: any) => ledger.push(data)) },
    order: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  return {
    client: { $transaction: vi.fn(async (callback: any) => callback(tx)) },
    tx,
    payment,
    commission,
    adjustments,
    ledger,
  };
}

describe("verified refund and dispute accounting", () => {
  it("reverses partial refunds proportionally, handles duplicates, and reverses the remainder on full refund", async () => {
    const state = adjustmentClient();
    const first = {
      provider: "razorpay" as const,
      eventId: "event-1",
      eventType: "refund.processed",
      kind: "REFUND" as const,
      externalId: "refund-1",
      providerPaymentId: "pay-1",
      status: "COMPLETED" as const,
      amountMinor: 2_000,
      currency: "INR",
      occurredAt: new Date("2026-10-31T12:00:00Z"),
    };
    expect(await processAffiliatePaymentAdjustment(state.client, first)).toMatchObject({ processed: true, duplicate: false });
    expect(state.ledger[0]).toMatchObject({ type: "COMMISSION_REVERSAL", amountMinor: -400 });
    expect(state.commission).toMatchObject({ reversedAmountMinor: 400, status: "PENDING" });
    expect(await processAffiliatePaymentAdjustment(state.client, first)).toMatchObject({ duplicate: true });

    await processAffiliatePaymentAdjustment(state.client, {
      ...first,
      eventId: "event-2",
      externalId: "refund-2",
      amountMinor: 8_000,
      occurredAt: new Date("2026-10-31T12:01:00Z"),
    });
    expect(state.payment.status).toBe("REFUNDED");
    expect(state.commission).toMatchObject({ reversedAmountMinor: 2_000, status: "REVERSED" });
    expect(state.ledger[1]).toMatchObject({ type: "COMMISSION_REVERSAL", amountMinor: -1_600 });
  });

  it("holds commissions during chargebacks and appends a restoration after the merchant wins", async () => {
    const state = adjustmentClient();
    const occurredAt = new Date("2026-10-31T12:00:00Z");
    await processAffiliatePaymentAdjustment(state.client, {
      provider: "razorpay", eventId: "refund-event", eventType: "refund.processed", kind: "REFUND",
      externalId: "refund-1", providerPaymentId: "pay-1", status: "COMPLETED", amountMinor: 2_000, currency: "INR", occurredAt,
    });
    await processAffiliatePaymentAdjustment(state.client, {
      provider: "razorpay", eventId: "dispute-open", eventType: "payment.dispute.created", kind: "CHARGEBACK",
      externalId: "dispute-1", providerPaymentId: "pay-1", status: "OPEN", amountMinor: 4_000, currency: "INR", occurredAt: new Date(occurredAt.getTime() + 1000),
    });
    expect(state.commission.status).toBe("DISPUTED");
    expect(state.commission.reversedAmountMinor).toBe(1_200);
    expect(state.ledger[1]).toMatchObject({ type: "COMMISSION_REVERSAL", amountMinor: -800 });

    await processAffiliatePaymentAdjustment(state.client, {
      provider: "razorpay", eventId: "dispute-won", eventType: "payment.dispute.won", kind: "CHARGEBACK",
      externalId: "dispute-1", providerPaymentId: "pay-1", status: "WON", amountMinor: 4_000, currency: "INR", occurredAt: new Date(occurredAt.getTime() + 2000),
    });
    expect(state.commission).toMatchObject({ status: "PENDING", reversedAmountMinor: 400, statusBeforeDispute: null });
    expect(state.ledger[2]).toMatchObject({ type: "COMMISSION_RESTORATION", amountMinor: 800 });
  });

  it("does not let delayed pending or open events reverse completed provider states", async () => {
    const state = adjustmentClient();
    const occurredAt = new Date("2026-10-31T12:00:00Z");
    const completed = {
      provider: "razorpay" as const,
      eventId: "refund-completed",
      eventType: "refund.processed",
      kind: "REFUND" as const,
      externalId: "refund-1",
      providerPaymentId: "pay-1",
      status: "COMPLETED" as const,
      amountMinor: 2_000,
      currency: "INR",
      occurredAt,
    };
    await processAffiliatePaymentAdjustment(state.client, completed);
    await processAffiliatePaymentAdjustment(state.client, {
      ...completed,
      eventId: "refund-created-delayed",
      eventType: "refund.created",
      status: "PENDING",
      occurredAt: new Date(occurredAt.getTime() + 1000),
    });
    expect(state.adjustments[0]).toMatchObject({ status: "COMPLETED", amountMinor: 2_000 });
    expect(state.commission.reversedAmountMinor).toBe(400);
    expect(state.ledger).toHaveLength(1);

    await processAffiliatePaymentAdjustment(state.client, {
      ...completed,
      eventId: "dispute-won",
      eventType: "payment.dispute.won",
      kind: "CHARGEBACK",
      externalId: "dispute-1",
      status: "WON",
      amountMinor: 4_000,
      occurredAt: new Date(occurredAt.getTime() + 2000),
    });
    await processAffiliatePaymentAdjustment(state.client, {
      ...completed,
      eventId: "dispute-created-delayed",
      eventType: "payment.dispute.created",
      kind: "CHARGEBACK",
      externalId: "dispute-1",
      status: "OPEN",
      amountMinor: 4_000,
      occurredAt: new Date(occurredAt.getTime() + 3000),
    });
    expect(state.adjustments.find((item) => item.kind === "CHARGEBACK")).toMatchObject({ status: "WON" });
    expect(state.commission.status).toBe("PENDING");
  });

  it("maps PayPal's documented resolved dispute outcomes conservatively", () => {
    expect(paypalDisputeStatus("CUSTOMER.DISPUTE.RESOLVED", "RESOLVED_SELLER_FAVOUR")).toBe("WON");
    expect(paypalDisputeStatus("CUSTOMER.DISPUTE.RESOLVED", "CANCELED_BY_BUYER")).toBe("WON");
    expect(paypalDisputeStatus("CUSTOMER.DISPUTE.RESOLVED", "RESOLVED_BUYER_FAVOUR")).toBe("LOST");
    expect(paypalDisputeStatus("CUSTOMER.DISPUTE.RESOLVED", "RESOLVED_WITH_PAYOUT")).toBe("CLOSED");
    expect(paypalDisputeStatus("CUSTOMER.DISPUTE.UPDATED", "RESOLVED_SELLER_FAVOUR")).toBe("OPEN");
  });

  it("does not acknowledge a verified adjustment before its local payment is finalized", async () => {
    const tx = {
      payment: { findFirst: vi.fn(async () => null) },
    };
    const client = { $transaction: vi.fn(async (callback: any) => callback(tx)) };
    await expect(processAffiliatePaymentAdjustment(client, {
      provider: "razorpay",
      eventId: "early-refund-event",
      eventType: "refund.processed",
      kind: "REFUND",
      externalId: "early-refund",
      providerPaymentId: "payment-not-finalized-yet",
      status: "COMPLETED",
      amountMinor: 100,
      currency: "INR",
      occurredAt: new Date("2026-10-31T12:00:00Z"),
    }, { maxAttempts: 2 })).rejects.toBeInstanceOf(AffiliatePaymentNotFoundError);
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });
});
