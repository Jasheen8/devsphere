# Affiliate Phase 1 — operations and release controls

This phase adds affiliate applications and review, template offers, consent-based referral tracking, checkout attribution, pending commissions, refund/dispute accounting, and an append-only ledger. It does not add payout execution. No migration has been applied to the existing hosted Supabase database.

## Database changes

`20261031210000_affiliate_phase1_foundation` creates nine tables: `AffiliateProfile`, `AffiliateProgramPolicy`, `AffiliateOffer`, `AffiliateReferralLink`, `AffiliateClick`, `AffiliateAttribution`, `AffiliateConversion`, `AffiliateCommission`, and `AffiliateLedgerEntry`. The SQL contains 22 restrictive foreign keys (the task brief referred to 18), plus the corresponding enums, uniqueness and lookup indexes, amount/rate/date checks, an append-only ledger trigger, and an initial policy row.

`20261101090000_affiliate_refund_dispute_hardening` adds dispute/reversal commission state and reversal amount, adds `AffiliatePaymentAdjustment` and `AffiliatePaymentWebhookEvent`, adds a restrictive adjustment-to-payment foreign key, changes `Payment -> Order` from cascade deletion to restrict, and protects webhook receipts and all 11 affiliate tables from direct Supabase Data API access. Both migrations are additive apart from the deliberate FK behavior change. They contain no `DROP TABLE`, `TRUNCATE`, or data deletion. Applying them to staging still requires an isolated project and a verified recovery point.

The Prisma application database role must be a trusted server-side role with the required table access. `anon`, `authenticated`, and `service_role` are explicitly revoked from the affiliate tables and RLS is enabled without client-facing policies. Express authentication and admin-role checks remain required; RLS is not an API authorization substitute. Do not add broad grants to make a misconfigured runtime role work.

## Deletion and retention rules

- Project deletion runs in a serializable transaction, locks its orders, and allows only unpaid draft/finalized orders with no payment rows or affiliate conversion, commission, or ledger history. It deletes only unconverted order attribution, keeps the click record, then removes existing project content. Errors roll back the whole transaction.
- User deletion has no API workflow today. The affiliate profile FK blocks deleting a user with an affiliate profile; preserve the profile and user until a supported retention/archive workflow exists. Do not cascade-delete commissions or ledger rows.
- The existing template `DELETE` endpoint unpublishes a template. Offers and affiliate history stay retained. Direct hard deletion is restricted while affiliate records reference the template.
- Affiliate profiles are reviewed, suspended, or rejected by status changes; offers and referral links are paused/deactivated. There is no hard-delete API for profiles, offers, conversions, commissions, or ledger entries.
- Payment records are financial evidence. Project deletion rejects any order that has a `Payment` row, including failed attempts.

## Refunds and disputes

Razorpay refund and dispute webhooks and PayPal capture-refund and dispute webhooks are verified before the adjustment service runs. The service serializes on the order/payment, stores unique provider event receipts, updates one provider adjustment record per external adjustment, protects terminal states from delayed lower-state events, computes reversal deltas in minor currency units, and writes compensating ledger entries. Duplicate delivery has no second financial effect. If a verified refund/dispute arrives before its local payment row is committed, it retries briefly and returns an error so the provider can retry; it is never acknowledged as processed. Refund totals exceeding the captured payment fail the transaction. Full refunds mark the payment/order refunded; chargebacks hold the commission in `DISPUTED`; seller-favorable outcomes append restorations.

Subscribe the provider webhook endpoints to the corresponding refund and dispute event names in each provider's test/live configuration. A PayPal resolved outcome that is ambiguous (`RESOLVED_WITH_PAYOUT`, `NONE`, or unknown) remains conservatively held as `CLOSED` for manual reconciliation. No payout rail is enabled in Phase 1. Verify each provider's payloads and webhook signature behavior with sandbox credentials before release.

## Separate Supabase staging project

1. In Supabase, create a **new project** dedicated to staging, separate from the currently configured hosted project and from production. Use a new database password and keep its project reference and credentials private. Do not point staging at the existing hosted database.
2. If the purpose is to prove migration preservation, load a sanitized, consented snapshot of representative pre-migration users, templates, orders, payments, and projects into staging before migration. Verify the staging project reference in its dashboard.
3. Copy `apps/api/.env.staging.example` to the ignored `apps/api/.env.staging`. Set `AFFILIATE_STAGING_PROJECT_REF`, `AFFILIATE_STAGING_DATABASE_URL`, and `AFFILIATE_STAGING_DIRECT_URL` to that staging project's own pooler/direct URLs. The guard accepts only `db.<ref>.supabase.co` direct hosts or regional `*.pooler.supabase.com` hosts with the matching project-qualified username. Keep `AFFILIATE_STAGING_CONFIRM` exactly as shown. Do not copy production secrets into this file.
4. Run `npm run prisma:migrate:affiliate-staging -w apps/api`. The guard requires both stage URLs to resolve to the expected 20-character project ref and rejects a ref matching the configured app database. It uses the repository's `prisma:migrate:deploy` workflow. Before migration it hashes selected existing user/template/order/payment/project fields in memory; after migration it verifies the fingerprint is unchanged. It does not print credentials or row content.
5. Run `npm run test:affiliate:staging -w apps/api`. The gated database suite verifies migration presence, legacy data integrity during test execution, affiliate application/admin approval, consent and referral attribution, self-referral, expiry, conversion and duplicate webhooks, refunds/disputes, ledger immutability, deletion/retention, API authorization, RLS, and direct Data API grants.
6. Run the regular API/unit and repository build suites. Provider-specific signed webhook end-to-end tests still require separate Razorpay/PayPal sandbox configuration.

The staging scripts refuse to run without explicit staging credentials and the confirmation value. Do not use `prisma migrate dev`, `db push`, or a hand-run SQL session as a substitute for the repository's staging deployment command.

## Backup and recovery checklist

Before any migration to a shared or production database, a release owner must verify and record:

- The database project reference and environment from the Supabase dashboard; do not infer production/staging from a region or URL alone.
- The latest successful backup/PITR restore point, its timestamp, retention window, and whether it is restorable under the current plan.
- A restore rehearsal to a separate project and an application-level check of users, templates, orders, payments, and projects.
- The migration SQL checksum and the expected migration status; confirm no migration is pending or partially applied unexpectedly.
- A tested rollback/recovery owner and forward-fix plan. Affiliate financial data must not be removed as rollback; disable the program and deploy a forward migration instead.
- Staging test results and a documented approval before the separate production deployment window.

The repository cannot verify that a hosted backup exists or is restorable. Do not treat a dashboard label or the presence of PITR as a tested restore.

## Production deployment procedure

Production deployment is a separate change after staging review and explicit production approval:

1. Freeze the migration artifact and release commit; confirm the production project ref from Supabase's project dashboard and the server's Prisma role/privileges using a read-only database session.
2. Verify the checklist above and obtain a tested restore point. Take the normal maintenance window and identify the operator and recovery owner.
3. Set production `DATABASE_URL`/`DIRECT_URL` only in the protected deployment secret store. Do not place them in `.env.staging` or logs.
4. Deploy with the repository's existing Prisma workflow (`npm run db:generate`, then API `prisma:migrate:deploy`) only after separate explicit approval for that production target. Do not use `prisma migrate dev` or `db push`.
5. Deploy API/web code, verify health and authenticated affiliate/admin API behavior, inspect migration records and provider webhook deliveries, and compare key data counts. Disable the program and use a forward fix if checks fail; never cascade-delete financial history.

This phase is not production-ready until the isolated staging database migration and all database-backed checks pass, the actual Prisma role/RLS privileges are verified, provider webhooks are exercised with signed sandbox events, backup recovery is verified, and production deployment is separately approved.
