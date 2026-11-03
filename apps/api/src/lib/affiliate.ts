import crypto from "node:crypto";
import { getSessionSecret } from "./session-secret.js";

export const AFFILIATE_ATTRIBUTION_COOKIE = "devsphere_affiliate_attribution";
export const AFFILIATE_VISITOR_COOKIE = "devsphere_affiliate_visitor";

type AttributionPayload = {
  clickId: string;
  expiresAt: number;
};

function signature(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest();
}

function constantTimeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function signAffiliateAttribution(payload: AttributionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifyAffiliateAttribution(value: unknown, now = Date.now()) {
  if (typeof value !== "string") return null;
  const [encoded, providedSignature, extra] = value.split(".");
  if (!encoded || !providedSignature || extra) return null;

  let received: Buffer;
  try {
    received = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }

  if (!constantTimeEqual(signature(encoded), received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AttributionPayload;
    if (
      typeof payload.clickId !== "string" ||
      payload.clickId.length < 1 ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function hashAffiliateVisitor(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function createAffiliateCode() {
  return `af-${crypto.randomBytes(9).toString("base64url").toLowerCase()}`;
}

export function calculateCommissionMinor(amountMinor: number, commissionBps: number) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    !Number.isInteger(commissionBps) ||
    commissionBps < 0 ||
    commissionBps > 10_000
  ) {
    throw new Error("Invalid affiliate commission input");
  }

  const numerator = BigInt(amountMinor) * BigInt(commissionBps) + 5_000n;
  return Number(numerator / 10_000n);
}

export function eligibleCommissionAmountMinor(order: { amount: number | bigint }) {
  const amount = Number(order.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid eligible order amount");
  // Orders do not yet model tax, discounts, or shipping separately. Until those
  // are split into authoritative integer-minor-unit fields, the verified order
  // total is the single approved commission basis.
  return amount;
}

export function isCreatorCommissionWithinPolicy(commissionBps: number, policy: { creatorMinCommissionBps: number; creatorMaxCommissionBps: number }) {
  return Number.isInteger(commissionBps) &&
    commissionBps >= policy.creatorMinCommissionBps &&
    commissionBps <= policy.creatorMaxCommissionBps;
}

export function calculatePendingCommissionMinor(entries: Array<{ type: string; amountMinor: number }>) {
  return entries.reduce((total, entry) => {
    if (entry.type === "COMMISSION_PENDING_CREDIT" || entry.type === "COMMISSION_RESTORATION" || entry.type === "COMMISSION_REVERSAL") {
      return total + entry.amountMinor;
    }
    return total;
  }, 0);
}

export async function getCurrentAffiliatePolicy(client: any, now = new Date()) {
  return client.affiliateProgramPolicy.findFirst({
    where: { effectiveAt: { lte: now } },
    orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
  });
}

export async function recordVerifiedAffiliateConversion(
  tx: any,
  args: {
    order: any;
    paymentId: string;
    verifiedPaymentId: string;
    now?: Date;
  },
) {
  const attribution = args.order.affiliateAttribution;
  if (!attribution) return false;

  const convertedAt = args.now || new Date();
  if (new Date(attribution.expiresAt).getTime() <= convertedAt.getTime()) return false;

  const amountMinor = eligibleCommissionAmountMinor(args.order);
  const commissionAmountMinor = calculateCommissionMinor(
    amountMinor,
    attribution.commissionBps,
  );
  const conversionId = crypto.randomUUID();

  const inserted = await tx.affiliateConversion.createMany({
    data: [
      {
        id: conversionId,
        orderId: args.order.id,
        paymentId: args.paymentId,
        attributionId: attribution.id,
        affiliateProfileId: attribution.affiliateProfileId,
        referralLinkId: attribution.referralLinkId,
        offerId: attribution.offerId,
        currency: args.order.currency,
        eligibleAmountMinor: amountMinor,
        verifiedPaymentId: args.verifiedPaymentId,
        convertedAt,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count === 0) return false;

  const commissionId = crypto.randomUUID();
  await tx.affiliateCommission.create({
    data: {
      id: commissionId,
      conversionId,
      orderId: args.order.id,
      affiliateProfileId: attribution.affiliateProfileId,
      currency: args.order.currency,
      eligibleAmountMinor: amountMinor,
      commissionBps: attribution.commissionBps,
      commissionAmountMinor,
      offerVersion: attribution.offerVersion,
      policyVersion: attribution.policyVersion,
      status: "PENDING",
    },
  });

  if (commissionAmountMinor > 0) {
    await tx.affiliateLedgerEntry.create({
      data: {
        affiliateProfileId: attribution.affiliateProfileId,
        commissionId,
        type: "COMMISSION_PENDING_CREDIT",
        amountMinor: commissionAmountMinor,
        currency: args.order.currency,
        idempotencyKey: `affiliate-pending-commission:${args.order.id}`,
        reference: args.order.id,
      },
    });
  }

  return true;
}
