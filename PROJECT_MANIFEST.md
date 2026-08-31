# Memora project manifest

## Runnable product surfaces
- Landing page: `/`
- Template gallery: `/templates`
- Template preview: `/templates/:slug`
- Auth: `/login`
- Customer dashboard: `/dashboard`
- Data-driven editor: `/edit/:projectId`
- Checkout: `/checkout/:projectId`
- Published share/reveal settings: `/published/:projectId`
- Public site: `/r/:slug`
- Admin: `/admin`
- Admin schema editor: `/admin/templates/:templateId`

## Backend surfaces
- Auth + verification/reset token endpoints
- Public catalog/pricing
- Project CRUD/finalize/publish/reveal config
- S3-compatible presigned media flow
- Razorpay order/verify/webhook flow
- Public rendering/unlock endpoint
- Admin dashboard/order/user/template/category/settings APIs

## Important production boundaries
- PostgreSQL is the source of truth.
- No customer website deployment per project.
- Customer secrets for PIN/puzzle are bcrypt hashed.
- Payment success is accepted only after server-side signature verification/webhook verification.
- Webhook uses raw request body before JSON parsing.
- File uploads use presigned object storage; local disk is not a production dependency.
