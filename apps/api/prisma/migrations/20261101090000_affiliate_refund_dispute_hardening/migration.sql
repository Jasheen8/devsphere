ALTER TYPE "AffiliateCommissionStatus" ADD VALUE 'DISPUTED';
ALTER TYPE "AffiliateLedgerEntryType" ADD VALUE 'COMMISSION_RESTORATION';

ALTER TABLE "AffiliateCommission"
  ADD COLUMN "reversedAmountMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "statusBeforeDispute" "AffiliateCommissionStatus";

ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_reversedAmountMinor_check"
  CHECK ("reversedAmountMinor" >= 0 AND "reversedAmountMinor" <= "commissionAmountMinor");

-- Preserve payment evidence when an unpaid order is removed. The project-delete
-- workflow explicitly checks for payment rows before deleting any order.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "AffiliatePaymentAdjustmentKind" AS ENUM ('REFUND', 'CHARGEBACK');
CREATE TYPE "AffiliatePaymentAdjustmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'OPEN', 'WON', 'LOST', 'CLOSED', 'FAILED');

CREATE TABLE "AffiliatePaymentAdjustment" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "kind" "AffiliatePaymentAdjustmentKind" NOT NULL,
  "status" "AffiliatePaymentAdjustmentStatus" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "providerUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffiliatePaymentAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliatePaymentAdjustment_amountMinor_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "AffiliatePaymentAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliatePaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliatePaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliatePaymentAdjustment_provider_kind_externalId_key"
  ON "AffiliatePaymentAdjustment"("provider", "kind", "externalId");
CREATE INDEX "AffiliatePaymentAdjustment_paymentId_kind_status_idx"
  ON "AffiliatePaymentAdjustment"("paymentId", "kind", "status");
CREATE UNIQUE INDEX "AffiliatePaymentWebhookEvent_provider_eventId_key"
  ON "AffiliatePaymentWebhookEvent"("provider", "eventId");
CREATE INDEX "AffiliatePaymentWebhookEvent_provider_eventType_receivedAt_idx"
  ON "AffiliatePaymentWebhookEvent"("provider", "eventType", "receivedAt");

CREATE FUNCTION prevent_affiliate_webhook_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Affiliate payment webhook events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AffiliatePaymentWebhookEvent_append_only"
BEFORE UPDATE OR DELETE ON "AffiliatePaymentWebhookEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_affiliate_webhook_event_mutation();

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'AffiliateProfile',
    'AffiliateProgramPolicy',
    'AffiliateOffer',
    'AffiliateReferralLink',
    'AffiliateClick',
    'AffiliateAttribution',
    'AffiliateConversion',
    'AffiliateCommission',
    'AffiliateLedgerEntry',
    'AffiliatePaymentAdjustment',
    'AffiliatePaymentWebhookEvent'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I FROM PUBLIC, anon, authenticated, service_role',
      table_name
    );
  END LOOP;
END;
$$;
