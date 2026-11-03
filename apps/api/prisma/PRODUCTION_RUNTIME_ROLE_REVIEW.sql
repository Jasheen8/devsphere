-- REVIEW ONLY — prepared from the staging-validated runtime-role matrix.
-- This is NOT a Prisma migration and has NOT been executed against production.
-- Run only after separate production approval, after the eight app migrations,
-- with an administrative session-pooler connection. Keep this file out of any
-- automated deployment step. The role stays NOLOGIN until a password is set.

BEGIN;

-- The privilege bundle is never used to connect. The API connects as the
-- separate LOGIN principal below and inherits only this membership.
CREATE ROLE devsphere_app_privileges
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
  NOREPLICATION NOBYPASSRLS;

CREATE ROLE devsphere_app_runtime
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT
  NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 30;

GRANT devsphere_app_privileges TO devsphere_app_runtime;
GRANT CONNECT ON DATABASE postgres TO devsphere_app_privileges;
GRANT USAGE ON SCHEMA public TO devsphere_app_privileges;

-- The Express API is the only intended database client. Remove the unnecessary
-- table-level powers verified on these Data API roles; do not add CRUD grants.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public."User" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."EmailToken" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Category" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Template" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Project" TO devsphere_app_privileges;
GRANT INSERT, DELETE ON TABLE public."ProjectRevision" TO devsphere_app_privileges;
GRANT SELECT ("id", "projectId") ON TABLE public."ProjectRevision" TO devsphere_app_privileges;
GRANT SELECT, INSERT, DELETE ON TABLE public."ProjectMedia" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."PublishedSite" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."SiteAccessRule" TO devsphere_app_privileges;
GRANT SELECT ON TABLE public."PricingPlan" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Order" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Payment" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Favorite" TO devsphere_app_privileges;
GRANT INSERT ON TABLE public."AuditLog" TO devsphere_app_privileges;
GRANT SELECT ("id") ON TABLE public."AuditLog" TO devsphere_app_privileges;
GRANT SELECT ON TABLE public."AppSetting" TO devsphere_app_privileges;
GRANT SELECT, INSERT ON TABLE public."AnalyticsEvent" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AffiliateProfile" TO devsphere_app_privileges;
GRANT SELECT, INSERT ON TABLE public."AffiliateProgramPolicy" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AffiliateOffer" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AffiliateReferralLink" TO devsphere_app_privileges;
GRANT SELECT, INSERT ON TABLE public."AffiliateClick" TO devsphere_app_privileges;
GRANT SELECT, INSERT, DELETE ON TABLE public."AffiliateAttribution" TO devsphere_app_privileges;
GRANT SELECT, INSERT ON TABLE public."AffiliateConversion" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AffiliateCommission" TO devsphere_app_privileges;
GRANT SELECT, INSERT ON TABLE public."AffiliateLedgerEntry" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AffiliatePaymentAdjustment" TO devsphere_app_privileges;
GRANT INSERT ON TABLE public."AffiliatePaymentWebhookEvent" TO devsphere_app_privileges;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApiRateLimitBucket" TO devsphere_app_privileges;

-- The affiliate and rate-limit tables have RLS enabled by the migrations.
-- Express enforces row ownership/admin authorization; this trusted backend role
-- receives table-scoped access. These policies do not provide row isolation.
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateProfile"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateProgramPolicy"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateOffer"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateReferralLink"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateClick"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateAttribution"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateConversion"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateCommission"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliateLedgerEntry"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliatePaymentAdjustment"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."AffiliatePaymentWebhookEvent"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);
CREATE POLICY "devsphere_app_runtime_access" ON public."ApiRateLimitBucket"
  FOR ALL TO devsphere_app_privileges USING (true) WITH CHECK (true);

COMMIT;

-- After a separate security-approved secret handoff, set the runtime LOGIN
-- principal's password through psql's prompt or the dashboard. Then enable:
--   \password devsphere_app_runtime
--   ALTER ROLE devsphere_app_runtime LOGIN;
-- Do not put the password in this file, shell history, a URL, or image build args.
