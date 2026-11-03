# Project deletion migration-window bridge

This is a small, backward-compatible bridge patch for the currently checked-in legacy API. It adds no Prisma model, table, migration, or affiliate dependency. The patch is in `MIGRATION_WINDOW_PROJECT_DELETE_BRIDGE.patch` and is intended to be applied and released from the legacy API source **before** the four pending production migrations.

The bridge checks `PROJECT_DELETION_PAUSED=true` at the start of `DELETE /projects/:id`, before any database query. While set, it returns HTTP 503 with `Retry-After: 60`. This prevents the legacy route from deleting unpaid orders during the foreign-key migration window. The candidate API implements the same switch through `isProjectDeletionPaused()`.

## Release order

1. Apply the patch to the legacy API release source and build/test it. Set `PROJECT_DELETION_PAUSED=true` on the legacy Render API and deploy that bridge release before any migration.
2. Confirm project deletion returns 503 and leaves the project/order unchanged.
3. Keep the flag enabled through all four migrations, the new API deployment, and post-deployment payment/deletion smoke tests.
4. Only after the new API `/version` is verified and unpaid-order deletion is validated against staging-tested protections, unset the flag. If any deployment or migration check fails, leave the flag enabled.

The bridge patch is not deployed. It has been checked against the legacy source at the release base commit; production metadata still does not establish which commit is currently deployed. Verify the Render API SHA before using this bridge.
