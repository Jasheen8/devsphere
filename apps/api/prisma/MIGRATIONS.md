# Prisma migrations

The checked-in schema is the source of truth. Generate and apply the initial production migration with:

```bash
npm run db:generate
npm run db:migrate -- --name init
```

Commit the generated folder under `apps/api/prisma/migrations/` produced by Prisma. This repository intentionally does not contain a hand-written approximation of Prisma's generated SQL.
