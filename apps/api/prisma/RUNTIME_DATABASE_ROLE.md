# Prisma runtime database role

This application uses Prisma through the Express API. The browser does not use Supabase Data API clients, and user/administrator authorization is enforced by the API routes. The Prisma runtime credential must therefore be a backend-only LOGIN principal that inherits table-scoped DML from a separate NOLOGIN privilege role, separate from the role used by Prisma Migrate.

The production design is `devsphere_app_privileges` (NOLOGIN, owns the reviewed grants and RLS policies) plus `devsphere_app_runtime` (LOGIN, INHERIT, member of only that privilege role). Do not grant table privileges directly to the login principal. Keep both roles NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS. The login principal has no schema/table privileges except those inherited through its single membership.

## Required runtime grants

Grant `CONNECT` on the application database and `USAGE` on `public` to `devsphere_app_privileges`. The runtime principal inherits them. Do not grant schema `CREATE`, database `CREATE`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, membership in a privileged role, or migration-table access. Do not grant `TRUNCATE`, `TRIGGER`, or `REFERENCES` on application tables.

| Table | Inherited runtime privileges | Why |
| --- | --- | --- |
| `User` | SELECT, INSERT, UPDATE | Registration, authentication, profile/status changes, admin listing |
| `EmailToken` | SELECT, INSERT, UPDATE | Verification and password-reset token lifecycle |
| `Category` | SELECT, INSERT, UPDATE | Catalog reads and admin creation/updates |
| `Template` | SELECT, INSERT, UPDATE | Catalog reads and admin creation/updates; deletion is archival |
| `Project` | SELECT, INSERT, UPDATE, DELETE | Project CRUD and controlled project deletion |
| `ProjectRevision` | INSERT, SELECT(`id`, `projectId`), DELETE | Revision creation returns only its ID; cleanup filters revisions by project ID |
| `ProjectMedia` | SELECT, INSERT, DELETE | Media counts, reads, uploads and cleanup |
| `PublishedSite` | SELECT, INSERT, UPDATE | Publishing, public reads and status updates |
| `SiteAccessRule` | SELECT, INSERT, UPDATE | Upserted publication access rules |
| `PricingPlan` | SELECT | Checkout plan lookup |
| `Order` | SELECT, INSERT, UPDATE, DELETE | Checkout, payment status, and deletion of eligible unpaid orders |
| `Payment` | SELECT, INSERT, UPDATE | Verified payment lifecycle; never delete payment evidence |
| `Favorite` | SELECT, INSERT, UPDATE, DELETE | User template favorites |
| `AuditLog` | INSERT, SELECT(`id`) | Append audit events; create calls return only the generated ID |
| `AppSetting` | SELECT | Settings read endpoint |
| `AnalyticsEvent` | SELECT, INSERT | Event collection and admin analytics |
| `AffiliateProfile` | SELECT, INSERT, UPDATE | Application and profile review lifecycle |
| `AffiliateProgramPolicy` | SELECT, INSERT | Effective policy lookup and safe bootstrap only |
| `AffiliateOffer` | SELECT, INSERT, UPDATE | Offer creation and controlled updates |
| `AffiliateReferralLink` | SELECT, INSERT, UPDATE | Referral-link creation and deactivation |
| `AffiliateClick` | SELECT, INSERT | Consent-based referral tracking |
| `AffiliateAttribution` | SELECT, INSERT, DELETE | Attach eligible click to order; remove only unconverted attribution during unpaid-order deletion |
| `AffiliateConversion` | SELECT, INSERT | Verified-payment conversion records |
| `AffiliateCommission` | SELECT, INSERT, UPDATE | Pending commission and refund/dispute state transitions |
| `AffiliateLedgerEntry` | SELECT, INSERT | Append-only financial ledger |
| `AffiliatePaymentAdjustment` | SELECT, INSERT, UPDATE | Idempotent refund/chargeback adjustment state |
| `AffiliatePaymentWebhookEvent` | INSERT | Webhook event idempotency record |
| `ApiRateLimitBucket` | SELECT, INSERT, UPDATE, DELETE | Shared fixed-window rate-limit counters and expiry cleanup |

No runtime grant is required for `Profile`, `Session`, `TemplateField`, `TemplateSection`, or `_prisma_migrations` based on the current Prisma call sites. Re-scan call sites before adding a grant for a future feature.

## RLS and Data API

The production API currently authenticates requests and enforces owner/admin checks in Express. No frontend `supabase-js` client or direct table query is present. Keep the public schema tables unavailable to `anon`, `authenticated`, and `service_role` unless a separately reviewed feature establishes a need.

RLS was enabled on all 32 application tables and `_prisma_migrations` in staging, with no policies before the role test. A non-owner runtime role needs an explicit policy on each granted table. For this trusted Express-only role, the staging role test creates policies for the NOLOGIN privilege role with `USING (true)` and `WITH CHECK (true)` only on tables in the grant matrix; membership lets the LOGIN principal use those policies. This provides no row-identity isolation inside PostgreSQL: all user/owner authorization remains at the API boundary. Do not expose this role or its connection string to browsers, workers with unrelated trust boundaries, or clients.

For `AffiliateLedgerEntry` and `AffiliatePaymentWebhookEvent`, grant only SELECT/INSERT and INSERT respectively; keep append-only triggers as defense in depth. Do not grant UPDATE or DELETE on either table. The database constraint on commission status must continue to block payable states until a separately authorized payout lifecycle exists.

## Migration credential

Keep migration execution separate from the API runtime credential. The runtime role must not own tables, types, schemas, or `_prisma_migrations`. Prisma Migrate needs a session-mode connection and DDL authority for the migration job; the API uses the transaction pooler and table-scoped runtime grants. The production role/credential setup and any ownership transfer require a separately reviewed production change and are not performed by this preparation work.

## Production access-control remediation plan

Read-only catalog checks found the API currently connects as `postgres`, which has `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, and `CREATE` on `public`. The same identity is configured for runtime and direct connections. Production has no RLS policies. The three Data API roles have no SELECT/INSERT/UPDATE/DELETE grants on 21 existing public tables, but each has TRUNCATE, TRIGGER, and REFERENCES on all 21. `service_role` also has `BYPASSRLS` by Supabase design.

After explicit production approval, create and validate the backend runtime role from this matrix, configure runtime-only RLS policies where RLS is enabled, then set the API runtime connection to that role. Keep the migration credential isolated to the migration job. Revoke the unnecessary TRUNCATE/TRIGGER/REFERENCES grants from `anon`, `authenticated`, and `service_role`; do not broadly grant Data API access to resolve runtime permission errors. Preserve API-level authorization and verify no external client depends on Data API table grants first.

## Staging validation procedure

The staging role check creates a temporary `devsphere_app_privileges` NOLOGIN group and `devsphere_app_runtime` LOGIN INHERIT principal only in the separate staging project, with a randomly generated in-memory password. It validates role flags, the exact one-way membership, inherited schema/table/column privileges, RLS policy access, then runs all 13 affiliate database tests, the remaining template-engine and API test suites over the runtime principal, and the production build. The database-backed affiliate suite runs once rather than twice to avoid saturating the shared staging pooler. Both temporary roles, policies, table grants, and column grants are removed in `finally`; cleanup is checked, and no runtime credential is written to tracked files or printed.

To run it again, set `AFFILIATE_STAGING_ROLE_TEST_CONFIRM` to `I-CONFIRM-ONLY-DEVSPHERE-STAGING` for the process and run `npm run test:runtime-role:staging -w apps/api`. The script hard-checks the known staging project reference and rejects the production reference before opening a connection.
