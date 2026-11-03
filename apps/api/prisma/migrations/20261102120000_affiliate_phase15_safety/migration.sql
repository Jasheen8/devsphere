-- New installations and existing staging installations start with the affiliate
-- program closed. An administrator must explicitly enable it after approving policy.
ALTER TABLE "AffiliateProgramPolicy"
  ALTER COLUMN "enabled" SET DEFAULT false;

UPDATE "AffiliateProgramPolicy"
SET "enabled" = false;

-- Shared fixed-window rate-limit storage. Keys contain a keyed digest, never an IP.
CREATE TABLE "ApiRateLimitBucket" (
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiRateLimitBucket_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "ApiRateLimitBucket_count_check" CHECK ("count" >= 1)
);

CREATE INDEX "ApiRateLimitBucket_expiresAt_idx" ON "ApiRateLimitBucket"("expiresAt");

ALTER TABLE "ApiRateLimitBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ApiRateLimitBucket" FROM PUBLIC, anon, authenticated, service_role;

-- This phase has no authorized release/payout workflow. Keep every commission
-- non-payable even if a future handler accidentally attempts a direct transition.
ALTER TABLE "AffiliateCommission"
  ADD CONSTRAINT "AffiliateCommission_release_workflow_required_check"
  CHECK ("status" IN ('PENDING', 'DISPUTED', 'REVERSED', 'VOID')) NOT VALID;
