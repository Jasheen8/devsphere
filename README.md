# Memora — Digital Gift Website Generator

A production-oriented full-stack SaaS foundation for creating personalized occasion websites from reusable, database-driven templates.

## Architecture

- `apps/web`: React + Vite + TypeScript customer/admin UI and public renderer.
- `apps/api`: Express + TypeScript API, auth, projects, publishing, Razorpay-ready payments, S3-compatible media presigning.
- `packages/template-engine`: schema-driven template renderer and reusable sections.
- `packages/shared`: shared types, Zod schemas and feature flags.
- PostgreSQL + Prisma for durable application data.

## Core principle

`Template + Schema + Project Data + Theme = Rendered Website`

No customer site gets its own deployment. A shared public route loads a published project by slug and renders the stored template definition/data.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `SESSION_SECRET`.
2. Install: `npm install`.
3. Generate Prisma client: `npm run db:generate`.
4. Run migrations: `npm run db:migrate`.
5. Seed demo data: `npm run db:seed`.
6. Start both apps: `npm run dev`.

Web: `http://localhost:5173`
API: `http://localhost:4000`

## Production notes

- Use a managed PostgreSQL instance.
- Use an S3-compatible object store; the API supports presigned uploads rather than local filesystem persistence.
- Put the web/API behind TLS and set secure cookie settings in production.
- Configure Razorpay keys + webhook secret. Payment finalization only happens after server-side signature/webhook verification.
- Configure a real email adapter for verification/reset emails.
- Store environment secrets only in the hosting provider's secret manager.
- Add CDN/image transformation in front of public media for large galleries.

## Adding a category

Create a `Category` row through the admin UI/API. Templates reference the category by ID; no renderer changes are required.

## Adding a template

Create a template record with a JSON `schema` containing sections/fields. The template engine maps `section.type` to a reusable renderer. New data-driven templates can be added without changing project/publishing architecture.

## Adding a new section

Add a typed section renderer under `packages/template-engine/src/sections`, register its type in `SectionRegistry`, then use that type in any template schema.

## Payment flow

1. API creates a Razorpay order using the selected plan and server-side price.
2. Web opens checkout.
3. API verifies the returned Razorpay signature.
4. Webhook verifies event signature and updates payment/order idempotently.
5. Only paid, finalized projects can publish.

## Testing

- Template engine unit tests: `npm run test`
- Add API integration/E2E tests against a test PostgreSQL database and Razorpay test credentials in CI.
