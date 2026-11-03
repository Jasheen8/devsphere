CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "AffiliateOfferStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'PAID', 'REVERSED', 'VOID');
CREATE TYPE "AffiliateLedgerEntryType" AS ENUM ('COMMISSION_PENDING_CREDIT', 'COMMISSION_REVERSAL', 'PAYOUT_RESERVATION', 'PAYOUT_RELEASE', 'PAYOUT_DEBIT', 'ADJUSTMENT');

CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "referralSlug" TEXT,
    "acceptedTermsVersion" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateProgramPolicy" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 2000,
    "creatorMinCommissionBps" INTEGER NOT NULL DEFAULT 1000,
    "creatorMaxCommissionBps" INTEGER NOT NULL DEFAULT 4000,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
    "termsVersion" TEXT NOT NULL DEFAULT 'phase1-v1',
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateProgramPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateProgramPolicy_defaultCommissionBps_check" CHECK ("defaultCommissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "AffiliateProgramPolicy_creatorMinCommissionBps_check" CHECK ("creatorMinCommissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "AffiliateProgramPolicy_creatorMaxCommissionBps_check" CHECK ("creatorMaxCommissionBps" BETWEEN "creatorMinCommissionBps" AND 10000),
    CONSTRAINT "AffiliateProgramPolicy_attributionWindowDays_check" CHECK ("attributionWindowDays" BETWEEN 1 AND 365)
);

CREATE TABLE "AffiliateOffer" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "status" "AffiliateOfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateOffer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateOffer_commissionBps_check" CHECK ("commissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "AffiliateOffer_dates_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
    CONSTRAINT "AffiliateOffer_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateReferralLink" (
    "id" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateReferralLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateReferralLink_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateReferralLink_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "AffiliateOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "visitorTokenHash" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateClick_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "AffiliateReferralLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateClick_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateAttribution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateAttribution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateAttribution_commissionBps_check" CHECK ("commissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "AffiliateAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAttribution_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "AffiliateClick"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAttribution_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAttribution_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "AffiliateReferralLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateAttribution_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "AffiliateOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "eligibleAmountMinor" INTEGER NOT NULL,
    "verifiedPaymentId" TEXT NOT NULL,
    "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateConversion_eligibleAmountMinor_check" CHECK ("eligibleAmountMinor" > 0),
    CONSTRAINT "AffiliateConversion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateConversion_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateConversion_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "AffiliateAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateConversion_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateConversion_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "AffiliateReferralLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateConversion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "AffiliateOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "eligibleAmountMinor" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "commissionAmountMinor" INTEGER NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateCommission_amounts_check" CHECK ("eligibleAmountMinor" > 0 AND "commissionAmountMinor" >= 0),
    CONSTRAINT "AffiliateCommission_commissionBps_check" CHECK ("commissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "AffiliateCommission_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "AffiliateConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AffiliateLedgerEntry" (
    "id" TEXT NOT NULL,
    "affiliateProfileId" TEXT NOT NULL,
    "commissionId" TEXT,
    "type" "AffiliateLedgerEntryType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateLedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AffiliateLedgerEntry_amount_check" CHECK ("amountMinor" <> 0),
    CONSTRAINT "AffiliateLedgerEntry_affiliateProfileId_fkey" FOREIGN KEY ("affiliateProfileId") REFERENCES "AffiliateProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateLedgerEntry_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "AffiliateCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_referralSlug_key" ON "AffiliateProfile"("referralSlug");
CREATE INDEX "AffiliateProfile_status_appliedAt_idx" ON "AffiliateProfile"("status", "appliedAt");
CREATE UNIQUE INDEX "AffiliateProgramPolicy_version_key" ON "AffiliateProgramPolicy"("version");
CREATE INDEX "AffiliateProgramPolicy_effectiveAt_version_idx" ON "AffiliateProgramPolicy"("effectiveAt", "version");
CREATE UNIQUE INDEX "AffiliateOffer_templateId_key" ON "AffiliateOffer"("templateId");
CREATE INDEX "AffiliateOffer_status_startsAt_endsAt_idx" ON "AffiliateOffer"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "AffiliateReferralLink_code_key" ON "AffiliateReferralLink"("code");
CREATE INDEX "AffiliateReferralLink_affiliateProfileId_createdAt_idx" ON "AffiliateReferralLink"("affiliateProfileId", "createdAt");
CREATE INDEX "AffiliateReferralLink_offerId_active_idx" ON "AffiliateReferralLink"("offerId", "active");
CREATE INDEX "AffiliateClick_referralLinkId_clickedAt_idx" ON "AffiliateClick"("referralLinkId", "clickedAt");
CREATE INDEX "AffiliateClick_visitorTokenHash_clickedAt_idx" ON "AffiliateClick"("visitorTokenHash", "clickedAt");
CREATE INDEX "AffiliateClick_affiliateProfileId_clickedAt_idx" ON "AffiliateClick"("affiliateProfileId", "clickedAt");
CREATE UNIQUE INDEX "AffiliateAttribution_orderId_key" ON "AffiliateAttribution"("orderId");
CREATE INDEX "AffiliateAttribution_affiliateProfileId_expiresAt_idx" ON "AffiliateAttribution"("affiliateProfileId", "expiresAt");
CREATE INDEX "AffiliateAttribution_clickId_idx" ON "AffiliateAttribution"("clickId");
CREATE UNIQUE INDEX "AffiliateConversion_orderId_key" ON "AffiliateConversion"("orderId");
CREATE UNIQUE INDEX "AffiliateConversion_paymentId_key" ON "AffiliateConversion"("paymentId");
CREATE UNIQUE INDEX "AffiliateConversion_attributionId_key" ON "AffiliateConversion"("attributionId");
CREATE INDEX "AffiliateConversion_affiliateProfileId_convertedAt_idx" ON "AffiliateConversion"("affiliateProfileId", "convertedAt");
CREATE INDEX "AffiliateConversion_offerId_convertedAt_idx" ON "AffiliateConversion"("offerId", "convertedAt");
CREATE UNIQUE INDEX "AffiliateCommission_conversionId_key" ON "AffiliateCommission"("conversionId");
CREATE INDEX "AffiliateCommission_affiliateProfileId_status_createdAt_idx" ON "AffiliateCommission"("affiliateProfileId", "status", "createdAt");
CREATE INDEX "AffiliateCommission_orderId_idx" ON "AffiliateCommission"("orderId");
CREATE UNIQUE INDEX "AffiliateLedgerEntry_idempotencyKey_key" ON "AffiliateLedgerEntry"("idempotencyKey");
CREATE INDEX "AffiliateLedgerEntry_affiliateProfileId_currency_createdAt_idx" ON "AffiliateLedgerEntry"("affiliateProfileId", "currency", "createdAt");
CREATE INDEX "AffiliateLedgerEntry_commissionId_idx" ON "AffiliateLedgerEntry"("commissionId");

CREATE FUNCTION prevent_affiliate_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Affiliate ledger entries are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AffiliateLedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "AffiliateLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_affiliate_ledger_mutation();

-- Affiliate records are served by the authenticated Express/Prisma API only.
-- Keep them unavailable through the Supabase Data API, including to service_role.
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
    'AffiliateLedgerEntry'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I FROM PUBLIC, anon, authenticated, service_role',
      table_name
    );
  END LOOP;
END;
$$;

INSERT INTO "AffiliateProgramPolicy" (
  "id", "version", "enabled", "defaultCommissionBps", "creatorMinCommissionBps",
  "creatorMaxCommissionBps", "attributionWindowDays", "termsVersion", "effectiveAt", "createdAt"
) VALUES (
  'affiliate-policy-v1', 1, true, 2000, 1000, 4000, 30, 'phase1-v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);
