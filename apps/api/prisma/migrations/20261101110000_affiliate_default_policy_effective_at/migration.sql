-- The bootstrap policy is immediately active. Using CURRENT_TIMESTAMP here
-- can leave it briefly in the future when the API host clock lags PostgreSQL.
UPDATE "AffiliateProgramPolicy"
SET "effectiveAt" = TIMESTAMP '2000-01-01 00:00:00.000'
WHERE "id" = 'affiliate-policy-v1'
  AND "version" = 1
  AND "termsVersion" = 'phase1-v1';
