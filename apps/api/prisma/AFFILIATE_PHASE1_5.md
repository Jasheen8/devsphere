# Affiliate Phase 1.5 operations and production readiness

## Policy and accounting

- Affiliate enrollment is off by default. The Phase 1.5 migration also closes the existing staging policy row. An administrator must explicitly enable a reviewed policy before applications, links, or attributed referrals can proceed.
- Every currently cataloged template is DevSphere-owned; the `Template` model has no creator owner. Platform offers therefore always use the current `defaultCommissionBps`, even when a client submits another rate. The backend rejects proposed rates outside the configured creator range. Creator-owned templates are not implemented; if ownership is added, its write endpoint must call `isCreatorCommissionWithinPolicy` using the active policy.
- Commissions use the verified order total in integer minor units as the one eligible amount basis. Orders do not currently separate taxes, discounts, or shipping; if those fields are introduced, the basis function must be amended in one reviewed change.
- Refund and chargeback reversals are represented by signed append-only ledger entries. The admin overview and affiliate dashboard calculate pending balances from credits, reversals, and restorations. New commissions stay `PENDING`. The Phase 1.5 database check prevents `AVAILABLE`, `RESERVED`, or `PAID` states until an authorized release implementation exists.
- No affiliate payout or transfer is enabled. Before that work, DevSphere must approve payout currencies, minimum balance, hold period, identity/tax checks, destination onboarding, fee treatment, payment provider, payout authorization roles, retry policy, reconciliation, dispute handling, and notification/receipt requirements. A release workflow must atomically reserve eligible ledger balance, submit a provider transfer idempotently, verify provider events, and append debit/release or compensating entries. Payout notifications are prepared but are not triggered by this phase.

## Email integration requirements

The API has a provider-neutral SMTP transport. Local/test environments without SMTP settings use an in-memory outbox; no message or token is printed. Production startup requires:

- `SMTP_HOST`: mail service hostname.
- `SMTP_PORT`: TCP port, normally 465 for implicit TLS or 587 for STARTTLS.
- `SMTP_SECURE`: `true` for implicit TLS; use `false` with STARTTLS on port 587.
- `SMTP_USER` and `SMTP_PASSWORD`: SMTP authentication credentials from the selected mail service's secret store.
- `SMTP_FROM`: verified sender email address.
- `ADMIN_EMAIL`: address for new affiliate application notifications.
- `APP_URL`: public HTTPS frontend origin used by authentication and CSRF/cookie policy.

No email vendor or credentials are selected here. The operator must select an SMTP-capable service, verify the sender/domain and deliverability, issue a least-privilege credential, store it only in the production secret manager, and set provider-side retention and bounce policies. Delivery is best-effort after database commits; a durable outbox/retry worker, bounce processing, and delivery metrics remain production hardening work. Verification and reset tokens are still delivered to the intended mailbox but are not persisted in provider-response fields or written to logs.

## Production migration history and read-only verification

The repository now contains eight ordered Prisma migrations:

1. `20260828100916_initial_memora_schema`
2. `20260830054551_add_template_live_demo`
3. `20261004133000_add_template_free_publication`
4. `20261004160000_add_order_watermark_removal`
5. `20261031210000_affiliate_phase1_foundation`
6. `20261101090000_affiliate_refund_dispute_hardening`
7. `20261101110000_affiliate_default_policy_effective_at`
8. `20261102120000_affiliate_phase15_safety`

Production was not contacted for this review. Which migrations production has applied, whether its `_prisma_migrations` history is missing, and whether schema drift exists are therefore **unknown**. Do not infer this from staging.

Before a separately approved production change, perform the following read-only inspection through the approved production read credential or a production clone:

1. Query `_prisma_migrations` for `migration_name`, `checksum`, `started_at`, `finished_at`, and `rolled_back_at`; omit `logs` and all connection details. Compare completed, non-rolled-back names/checksums with the eight repository files.
2. If `_prisma_migrations` is absent, compare every existing application object against migration 1 using `information_schema` and `pg_catalog`. Do not run `migrate deploy` against an existing schema until it is known whether a baseline is needed. `prisma migrate resolve --applied` is a controlled metadata write and needs separate approval after an exact baseline review.
3. Compare schema-only catalog fingerprints with a clean database produced from the migrations. Check enum values, columns/defaults/nullability, indexes, foreign keys, constraints, triggers, and RLS/grants. Do not use `db push` to repair drift.
4. Review provider query plans and lock behavior on a production-sized clone. Migration 8 changes the default and disables existing affiliate policy rows, creates an indexed rate-limit table, enables RLS/revokes Data API roles on that table, and adds a `NOT VALID` commission state constraint. It does not delete business rows. The policy update takes row locks; the table/constraint DDL requires brief catalog locks. The `NOT VALID` check avoids a table scan but rejects new non-pending release states.
5. If exact migration history and schema match, migrations 5–8 are the affiliate set that a database without Phase 1 affiliate work would need; migrations 1–4 are the legacy base only if actually absent. Never replay or baseline migrations based on an assumed production state.

The Phase 1.5 migration is forward-only. It intentionally contains no destructive drops or payment/ledger deletion. If a deployment fails, stop API rollout, inspect migration status and schema read-only, then either use a reviewed forward corrective migration or restore a verified pre-change backup/PITR point on an isolated recovery target first. Do not attempt ad hoc down SQL against the financial tables.

## Authentication, rate limits, and health checks

- Production startup fails if `SESSION_SECRET` is absent, weak, or the known development value. Use at least 32 bytes of generated high-entropy material; share it across API replicas to preserve sessions and shared rate-limit key stability.
- Unsafe API requests require an exact allowed `Origin` (or same-origin `Referer`) from `APP_URL`/the configured frontend origins. Payment provider webhook routes are exempt because provider signatures are their authentication mechanism. Cookie authentication remains HTTP-only, Secure, and `SameSite=None` in production.
- Authentication, affiliate enrollment/referral/API, payments, and admin operations use atomic shared fixed-window counters in `ApiRateLimitBucket`. The table stores keyed hashes rather than client IPs and is inaccessible to Supabase Data API roles. Production fails closed if the limiter database table is unavailable. The existing broad API limit remains an additional process-local guard.
- `/health` is process liveness. `/ready` probes the database and returns 503 when it is unavailable. Configure infrastructure to restart on failed liveness and remove instances from service on failed readiness.
- API errors are structured JSON and redact credentials, auth material, raw payment payloads, email addresses, and token-like values. Newly finalized `Payment` rows keep provider payment identifiers and verified state only; signature/raw fields are cleared. Existing legacy raw payment records are not scrubbed by migration 8 because that irreversible retention change requires separate data-retention and recovery approval.

## Staging-only validation and production release sequence

1. Create a separate Supabase staging project, configure ignored `apps/api/.env.staging`, and run `npm run prisma:migrate:affiliate-staging -w apps/api`. This wrapper verifies project identity, SSL and pooler mode, rejects configured database targets, fingerprints legacy business rows before/after, and invokes the repository's `prisma migrate deploy` workflow against staging only.
2. Run `npm run test:affiliate -w apps/api`; the wrapper must report 13 executed, 0 failed, 0 skipped database-backed tests. Then run `npm test` and `npm run build`.
3. Before production: verify a recent successful backup/PITR point, record backup timestamp/retention, test restore into an isolated project, record migration-history/schema comparison, and ensure application deployment can be rolled back independently.
4. In an approved maintenance window, apply only the reviewed missing migrations using the controlled Prisma deployment workflow. Re-check migration status and RLS/grants. Keep affiliate policy disabled.
5. Deploy API changes before frontend changes, with `SESSION_SECRET`, `APP_URL`, SMTP, `ADMIN_EMAIL`, payment webhook secrets, and database credentials in the secret manager. Do not expose values in logs or build arguments. Wait for `/ready`, then deploy the frontend.
6. Smoke-test registration/login, password reset and verification through a test mailbox, CSRF rejection/acceptance, rate-limit storage, `/health`, `/ready`, checkout/webhook verification in provider sandbox, refund/dispute idempotency, read-only affiliate admin, and disabled enrollment. Re-confirm no `AVAILABLE`/`PAID` affiliate commission transitions or payout actions exist.
7. If checks fail, disable affiliate entry points, remove unhealthy application instances, and stop further rollout. Preserve financial rows. Prefer a forward fix; restore from the verified backup/PITR only after measuring the data-loss window and practicing recovery on an isolated clone. Reconcile provider payment/refund events after restoration.

Do not mark production ready until production migration state is known, the SMTP integration has delivered end-to-end test messages, a restore drill succeeds, and payout policy decisions have been approved. Actual affiliate payouts remain disabled.
