import crypto from "node:crypto";

type AdjustmentInput = {
  provider: "razorpay" | "paypal";
  eventId: string;
  eventType: string;
  kind: "REFUND" | "CHARGEBACK";
  externalId: string;
  providerPaymentId: string;
  status: "PENDING" | "COMPLETED" | "OPEN" | "WON" | "LOST" | "CLOSED" | "FAILED";
  amountMinor: number;
  currency: string;
  occurredAt: Date;
};

export class AffiliatePaymentNotFoundError extends Error {
  constructor() {
    super("No local payment matches the verified provider adjustment yet; provider retry is required.");
    this.name = "AffiliatePaymentNotFoundError";
  }
}

function requirePositiveMinorAmount(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Payment adjustment amount must be a positive integer in minor units");
  }
}

function roundRatio(total: number, part: number, whole: number) {
  if (total < 0 || part < 0 || whole <= 0) throw new Error("Invalid commission reversal ratio");
  return Number((BigInt(total) * BigInt(part) + BigInt(Math.floor(whole / 2))) / BigInt(whole));
}

function getWebhookIdempotencyKey(input: AdjustmentInput) {
  return `affiliate-adjustment:${input.provider}:${input.eventId}`;
}

function adjustmentStatusRank(kind: AdjustmentInput["kind"], status: AdjustmentInput["status"]) {
  if (kind === "REFUND") {
    return status === "COMPLETED" ? 2 : status === "FAILED" ? 1 : 0;
  }
  return status === "WON" || status === "LOST" ? 2 : status === "OPEN" || status === "CLOSED" ? 1 : 0;
}

export function paypalDisputeStatus(eventType: string, outcomeValue: unknown): "OPEN" | "WON" | "LOST" | "CLOSED" {
  if (eventType !== "CUSTOMER.DISPUTE.RESOLVED") return "OPEN";
  const outcome = String(outcomeValue || "").toUpperCase();
  if (["RESOLVED_SELLER_FAVOUR", "CANCELED_BY_BUYER", "DENIED"].includes(outcome)) return "WON";
  if (["RESOLVED_BUYER_FAVOUR", "ACCEPTED"].includes(outcome)) return "LOST";
  // PayPal documents RESOLVED_WITH_PAYOUT as protection for either party;
  // unknown or ambiguous final outcomes stay held until manually reconciled.
  return "CLOSED";
}

async function lockPaymentAndOrder(tx: any, provider: string, providerPaymentId: string) {
  const existing = await tx.payment.findFirst({
    where: { provider, providerPaymentId },
    select: { id: true, orderId: true },
  });
  if (!existing) return null;

  await tx.$queryRaw`
    SELECT "id" FROM "Order" WHERE "id" = ${existing.orderId} FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT "id" FROM "Payment" WHERE "id" = ${existing.id} FOR UPDATE
  `;

  return tx.payment.findUnique({
    where: { id: existing.id },
    include: { order: true },
  });
}

async function updateCommissionReversal(tx: any, payment: any, event: AdjustmentInput) {
  const conversion = await tx.affiliateConversion.findUnique({
    where: { paymentId: payment.id },
    include: { commission: true },
  });
  const commission = conversion?.commission;
  if (!commission) return;

  const adjustments = await tx.affiliatePaymentAdjustment.findMany({
    where: { paymentId: payment.id },
    select: { kind: true, status: true, amountMinor: true },
  });
  const refundMinor = adjustments
    .filter((adjustment: any) => adjustment.kind === "REFUND" && adjustment.status === "COMPLETED")
    .reduce((sum: number, adjustment: any) => sum + adjustment.amountMinor, 0);
  const chargebackMinor = adjustments
    .filter((adjustment: any) =>
      adjustment.kind === "CHARGEBACK" &&
      ["OPEN", "CLOSED", "LOST"].includes(adjustment.status),
    )
    .reduce((sum: number, adjustment: any) => sum + adjustment.amountMinor, 0);
  const unresolvedDispute = adjustments.some((adjustment: any) =>
    adjustment.kind === "CHARGEBACK" && ["OPEN", "CLOSED"].includes(adjustment.status),
  );
  const riskyAmount = Math.min(
    commission.eligibleAmountMinor,
    refundMinor + chargebackMinor,
  );
  const targetReversed = roundRatio(
    commission.commissionAmountMinor,
    riskyAmount,
    commission.eligibleAmountMinor,
  );
  const delta = targetReversed - commission.reversedAmountMinor;

  if (delta !== 0) {
    await tx.affiliateLedgerEntry.create({
      data: {
        affiliateProfileId: commission.affiliateProfileId,
        commissionId: commission.id,
        type: delta > 0 ? "COMMISSION_REVERSAL" : "COMMISSION_RESTORATION",
        amountMinor: -delta,
        currency: commission.currency,
        idempotencyKey: getWebhookIdempotencyKey(event),
        reference: event.externalId,
      },
    });
  }

  let status = commission.status;
  let statusBeforeDispute = commission.statusBeforeDispute;
  if (unresolvedDispute) {
    if (status !== "DISPUTED") statusBeforeDispute = status;
    status = "DISPUTED";
  } else if (status === "DISPUTED") {
    status = targetReversed >= commission.commissionAmountMinor
      ? "REVERSED"
      : (statusBeforeDispute || "PENDING");
    statusBeforeDispute = null;
  } else if (targetReversed >= commission.commissionAmountMinor && commission.commissionAmountMinor > 0) {
    status = "REVERSED";
  } else if (status === "REVERSED" && targetReversed < commission.commissionAmountMinor) {
    // A later provider resolution can restore commission. Default to the
    // non-payable pending state when there is no prior approved state to restore.
    status = "PENDING";
  }

  await tx.affiliateCommission.update({
    where: { id: commission.id },
    data: {
      reversedAmountMinor: targetReversed,
      status,
      statusBeforeDispute,
    },
  });
}

/**
 * Persist one provider-verified webhook event and apply its financial effect
 * atomically. Caller must verify the provider signature before calling.
 */
async function applyAffiliatePaymentAdjustment(tx: any, input: AdjustmentInput) {
  // Lock order before payment, matching finalizePaidOrder and deletion lock order.
  const payment = await lockPaymentAndOrder(tx, input.provider, input.providerPaymentId);
  if (!payment) return { processed: false, duplicate: false };
  if (payment.currency !== input.currency || input.amountMinor > payment.amount) {
    throw new Error("Provider adjustment does not match the captured payment");
  }

  const insertedEvent = await tx.affiliatePaymentWebhookEvent.createMany({
    data: [{ provider: input.provider, eventId: input.eventId, eventType: input.eventType }],
    skipDuplicates: true,
  });
  if (insertedEvent.count === 0) return { processed: true, duplicate: true };

  const adjustmentKey = {
    provider_kind_externalId: {
      provider: input.provider,
      kind: input.kind,
      externalId: input.externalId,
    },
  };
  const currentAdjustment = await tx.affiliatePaymentAdjustment.findUnique({ where: adjustmentKey });
  const staleByTimestamp = Boolean(
    currentAdjustment?.providerUpdatedAt &&
    currentAdjustment.providerUpdatedAt.getTime() > input.occurredAt.getTime(),
  );
  const staleByState = Boolean(
    currentAdjustment &&
    adjustmentStatusRank(input.kind, currentAdjustment.status) > adjustmentStatusRank(input.kind, input.status),
  );
  const staleTerminalDispute = Boolean(
    input.kind === "CHARGEBACK" &&
    currentAdjustment &&
    ["WON", "LOST"].includes(currentAdjustment.status) &&
    ["OPEN", "CLOSED"].includes(input.status),
  );
  const staleProviderUpdate = staleByTimestamp || staleByState || staleTerminalDispute;
  const effectiveInput = staleProviderUpdate && currentAdjustment
    ? { ...input, status: currentAdjustment.status, amountMinor: currentAdjustment.amountMinor }
    : input;

  await tx.affiliatePaymentAdjustment.upsert({
    where: adjustmentKey,
    update: {
      paymentId: payment.id,
      status: effectiveInput.status,
      amountMinor: effectiveInput.amountMinor,
      currency: input.currency,
      providerUpdatedAt: currentAdjustment?.providerUpdatedAt && staleProviderUpdate
        ? currentAdjustment.providerUpdatedAt
        : input.occurredAt,
    },
    create: {
      paymentId: payment.id,
      provider: input.provider,
      externalId: input.externalId,
      kind: input.kind,
      status: effectiveInput.status,
      amountMinor: effectiveInput.amountMinor,
      currency: input.currency,
      providerUpdatedAt: input.occurredAt,
    },
  });

  const allRefunds = await tx.affiliatePaymentAdjustment.findMany({
    where: { paymentId: payment.id, kind: "REFUND", status: "COMPLETED" },
    select: { amountMinor: true },
  });
  const refundTotalMinor = allRefunds.reduce(
    (sum: number, refund: any) => sum + refund.amountMinor,
    0,
  );
  if (refundTotalMinor > payment.amount) {
    throw new Error("Provider refund total exceeds the captured payment");
  }

  if (refundTotalMinor === payment.amount && payment.amount > 0) {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    await tx.order.updateMany({
      where: { id: payment.orderId, status: "PAID" },
      data: { status: "REFUNDED" },
    });
  } else if (payment.status === "REFUNDED") {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED" } });
    await tx.order.updateMany({
      where: { id: payment.orderId, status: "REFUNDED" },
      data: { status: "PAID" },
    });
  }

  await updateCommissionReversal(tx, payment, effectiveInput);
  return { processed: true, duplicate: false };
}

export async function processAffiliatePaymentAdjustment(
  client: any,
  input: AdjustmentInput,
  retryOptions: { maxAttempts?: number } = {},
) {
  requirePositiveMinorAmount(input.amountMinor);
  if (!input.eventId || !input.externalId || !input.providerPaymentId) {
    throw new Error("Verified payment event is missing provider identifiers");
  }

  // Provider webhooks can beat the transaction that records a successful
  // checkout. Give that transaction a bounded retry window to commit before
  // asking the provider to redeliver the event. Each retry starts a fresh
  // serializable transaction so a missing payment cannot leave partial state.
  const maxAttempts = retryOptions.maxAttempts ?? 30;
  const retryDelay = (attempt: number) => Math.min(100 * 2 ** attempt, 1_000);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await client.$transaction(
        (tx: any) => applyAffiliatePaymentAdjustment(tx, input),
        {
          isolationLevel: "Serializable",
          // A verified checkout may still hold the order lock when a refund
          // or dispute webhook arrives. Keep the financial transaction
          // atomic while allowing that short payment-finalization window to
          // finish; the provider can still retry if contention exceeds this.
          maxWait: 10_000,
          timeout: 30_000,
        },
      );
      if (!result.processed) {
        if (attempt === maxAttempts - 1) throw new AffiliatePaymentNotFoundError();
        await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
        continue;
      }
      return result;
    } catch (error: any) {
      if (error?.code !== "P2034" || attempt === maxAttempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    }
  }
  throw new Error("Serializable affiliate payment event transaction did not complete");
}

export function stableWebhookEventId(provider: string, suppliedId: unknown, rawBody: string) {
  if (typeof suppliedId === "string" && suppliedId.trim()) return suppliedId.trim();
  return `body-sha256:${crypto.createHash("sha256").update(`${provider}:${rawBody}`).digest("hex")}`;
}
