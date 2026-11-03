import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadAndValidateStagingEnvironment,
  validateStagingRuntimeDatabaseTarget,
} from "../src/lib/staging-safety.js";

const EXPECTED_STAGING_REF = "fuxdijvxkzxemesmuawk";
const PRODUCTION_REF = "nghgrnyeitpanfqwhxje";
const PRIVILEGE_ROLE = "devsphere_app_privileges";
const ROLE_NAME = "devsphere_app_runtime";
const ROLE_CONFIRMATION = "I-CONFIRM-ONLY-DEVSPHERE-STAGING";
const POLICY_NAME = "devsphere_app_runtime_access";
const dynamicSecrets: string[] = [];

type RuntimeGrant = { table: string; privileges: string[]; columnSelect?: string[] };
const grants: RuntimeGrant[] = [
  { table: "User", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "EmailToken", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "Category", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "Template", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "Project", privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
  { table: "ProjectRevision", privileges: ["INSERT", "DELETE"], columnSelect: ["id", "projectId"] },
  { table: "ProjectMedia", privileges: ["SELECT", "INSERT", "DELETE"] },
  { table: "PublishedSite", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "SiteAccessRule", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "PricingPlan", privileges: ["SELECT"] },
  { table: "Order", privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
  { table: "Payment", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "Favorite", privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
  { table: "AuditLog", privileges: ["INSERT"], columnSelect: ["id"] },
  { table: "AppSetting", privileges: ["SELECT"] },
  { table: "AnalyticsEvent", privileges: ["SELECT", "INSERT"] },
  { table: "AffiliateProfile", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "AffiliateProgramPolicy", privileges: ["SELECT", "INSERT"] },
  { table: "AffiliateOffer", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "AffiliateReferralLink", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "AffiliateClick", privileges: ["SELECT", "INSERT"] },
  { table: "AffiliateAttribution", privileges: ["SELECT", "INSERT", "DELETE"] },
  { table: "AffiliateConversion", privileges: ["SELECT", "INSERT"] },
  { table: "AffiliateCommission", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "AffiliateLedgerEntry", privileges: ["SELECT", "INSERT"] },
  { table: "AffiliatePaymentAdjustment", privileges: ["SELECT", "INSERT", "UPDATE"] },
  { table: "AffiliatePaymentWebhookEvent", privileges: ["INSERT"] },
  { table: "ApiRateLimitBucket", privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"] },
];

function redact(text: string, values: string[]) {
  let output = text;
  for (const value of values.filter(Boolean)) output = output.split(value).join("[redacted database secret]");
  return output.replace(/\bpostgres(?:ql)?:\/\/[^\s'"<>]+/gi, "[redacted database URL]");
}

function runNpm(args: string[], env: NodeJS.ProcessEnv, urls: string[]) {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error("Run this command through npm so the repository workflow is available.");
  const rootDir = path.resolve(process.cwd(), "../..");
  const result = spawnSync(process.execPath, [npmExecPath, ...args], {
    cwd: rootDir,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  const output = redact(`${result.stdout || ""}${result.stderr || ""}`, urls);
  if (output.trim()) process.stdout.write(output);
  return result.status === 0 && !result.error;
}

async function main() {
  if (process.env.AFFILIATE_STAGING_ROLE_TEST_CONFIRM !== ROLE_CONFIRMATION) {
    throw new Error("Set the explicit staging-only role-test confirmation before running this command.");
  }

  const { stageUrl, directUrl, expectedRef } = loadAndValidateStagingEnvironment();
  if (expectedRef !== EXPECTED_STAGING_REF || expectedRef === PRODUCTION_REF) {
    throw new Error("Refusing runtime-role setup: the validated project is not the known isolated devsphere-staging project.");
  }

  const urls = [stageUrl, directUrl, process.env.DATABASE_URL || "", process.env.DIRECT_URL || ""];
  const adminDb = new PrismaClient({ datasources: { db: { url: directUrl } } });
  let runtimeDb: PrismaClient | undefined;
  let runtimeUrl = "";
  let privilegeRoleCreated = false;
  let runtimeRoleCreated = false;
  let cleanupFailure = false;
  let testResults: Array<{ name: string; passed: boolean }> = [];

  try {
    await adminDb.$connect();
    const identity = await adminDb.$queryRaw<Array<{
      database_name: string;
      connected_role: string;
      read_only: string;
      role_create_role: boolean;
      role_bypass_rls: boolean;
    }>>`
      SELECT current_database() AS database_name,
        current_user AS connected_role,
        current_setting('transaction_read_only') AS read_only,
        r.rolcreaterole AS role_create_role,
        r.rolbypassrls AS role_bypass_rls
      FROM pg_roles r WHERE r.rolname = current_user
    `;
    if (
      identity[0]?.database_name !== "postgres" ||
      identity[0]?.connected_role !== "postgres" ||
      identity[0]?.read_only !== "off" ||
      !identity[0]?.role_create_role ||
      identity[0]?.role_bypass_rls !== true
    ) {
      throw new Error("Staging administrative connection identity or privileges do not match the expected setup role.");
    }

    const migrationRows = await adminDb.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name
    `;
    if (migrationRows.length !== 8) throw new Error("Staging must have exactly eight successful repository migrations before role testing.");
    const existingRole = await adminDb.$queryRaw<Array<{ privilege_role: boolean; runtime_role: boolean }>>`
      SELECT
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${PRIVILEGE_ROLE}) AS privilege_role,
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${ROLE_NAME}) AS runtime_role
    `;
    if (existingRole[0]?.privilege_role || existingRole[0]?.runtime_role) {
      throw new Error("A temporary staging runtime role already exists; refusing to alter an existing role.");
    }
    const existingPolicies = await adminDb.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM pg_policies
      WHERE schemaname = 'public' AND policyname = ${POLICY_NAME}
    `;
    if (existingPolicies[0]?.count) throw new Error("A staging runtime test policy already exists; refusing to alter a policy not created in this run.");

    const rolePassword = randomBytes(36).toString("base64url");
    dynamicSecrets.push(rolePassword);
    await adminDb.$executeRawUnsafe(
      `CREATE ROLE "${PRIVILEGE_ROLE}" WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`,
    );
    privilegeRoleCreated = true;
    await adminDb.$executeRawUnsafe(
      `CREATE ROLE "${ROLE_NAME}" WITH LOGIN INHERIT PASSWORD '${rolePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 30`,
    );
    runtimeRoleCreated = true;
    await adminDb.$executeRawUnsafe(`GRANT "${PRIVILEGE_ROLE}" TO "${ROLE_NAME}"`);
    await adminDb.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "postgres" TO "${PRIVILEGE_ROLE}"`);
    await adminDb.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${PRIVILEGE_ROLE}"`);

    for (const { table, privileges, columnSelect = [] } of grants) {
      await adminDb.$executeRawUnsafe(
        `GRANT ${privileges.join(", ")} ON TABLE public."${table}" TO "${PRIVILEGE_ROLE}"`,
      );
      if (columnSelect.length) {
        await adminDb.$executeRawUnsafe(
          `GRANT SELECT (${columnSelect.map((column) => `"${column}"`).join(", ")}) ON TABLE public."${table}" TO "${PRIVILEGE_ROLE}"`,
        );
      }
      await adminDb.$executeRawUnsafe(
        `CREATE POLICY "${POLICY_NAME}" ON public."${table}" FOR ALL TO "${PRIVILEGE_ROLE}" USING (true) WITH CHECK (true)`,
      );
    }

    const runtime = new URL(stageUrl);
    runtime.username = `${ROLE_NAME}.${expectedRef}`;
    runtime.password = rolePassword;
    runtimeUrl = runtime.toString();
    dynamicSecrets.push(runtimeUrl);
    validateStagingRuntimeDatabaseTarget({ runtimeUrl, transactionUrl: stageUrl, expectedRef });
    urls.push(runtimeUrl, rolePassword);

    runtimeDb = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
    await runtimeDb.$connect();
    const runtimeState = await runtimeDb.$queryRaw<Array<{
      role: string;
      superuser: boolean;
      createdb: boolean;
      createrole: boolean;
      bypassrls: boolean;
      inherit: boolean;
      schema_usage: boolean;
      schema_create: boolean;
      migration_table_select: boolean;
      memberships: number;
      inherits_privilege_role: boolean;
    }>>`
      SELECT current_user AS role,
        r.rolsuper AS superuser,
        r.rolcreatedb AS createdb,
        r.rolcreaterole AS createrole,
        r.rolbypassrls AS bypassrls,
        r.rolinherit AS inherit,
        has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
        has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
        has_table_privilege(current_user, 'public."_prisma_migrations"', 'SELECT') AS migration_table_select,
        (SELECT count(*)::int FROM pg_auth_members m WHERE m.member = r.oid) AS memberships,
        pg_has_role(current_user, ${PRIVILEGE_ROLE}, 'USAGE') AS inherits_privilege_role
      FROM pg_roles r WHERE r.rolname = current_user
    `;
    const state = runtimeState[0];
    if (
      state?.role !== ROLE_NAME || state.superuser || state.createdb || state.createrole || state.bypassrls ||
      !state.inherit || state.schema_create || state.migration_table_select || state.memberships !== 1 ||
      !state.inherits_privilege_role || !state.schema_usage
    ) {
      throw new Error("Runtime LOGIN principal has an unexpected role flag, schema permission, migration permission, or privilege-role membership.");
    }

    const groupState = await runtimeDb.$queryRaw<Array<{ login: boolean; superuser: boolean; createdb: boolean; createrole: boolean; bypassrls: boolean }>>`
      SELECT r.rolcanlogin AS login, r.rolsuper AS superuser,
        r.rolcreatedb AS createdb, r.rolcreaterole AS createrole,
        r.rolbypassrls AS bypassrls
      FROM pg_roles r WHERE r.rolname = ${PRIVILEGE_ROLE}
    `;
    const group = groupState[0];
    if (!group || group.login || group.superuser || group.createdb || group.createrole || group.bypassrls) {
      throw new Error("Privilege role must remain NOLOGIN and have no elevated role attributes.");
    }

    const directGrantCount = await runtimeDb.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = current_user)
        AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    `;
    if (directGrantCount[0]?.count !== 0) {
      throw new Error("Table privileges must be inherited from the NOLOGIN privilege role, not granted directly to the LOGIN principal.");
    }

    const policyStates = await runtimeDb.$queryRaw<Array<{ tablename: string; roles: string[]; cmd: string }>>`
      SELECT tablename, roles::text[], cmd
      FROM pg_policies
      WHERE schemaname = 'public' AND policyname = ${POLICY_NAME}
      ORDER BY tablename
    `;
    if (
      policyStates.length !== grants.length ||
      policyStates.some(({ tablename, roles, cmd }) =>
        !grants.some((grant) => grant.table === tablename) ||
        !roles.includes(PRIVILEGE_ROLE) ||
        cmd !== "ALL"
      )
    ) {
      throw new Error("RLS policies must target the NOLOGIN privilege role on exactly the reviewed application tables.");
    }

    const violations = await runtimeDb.$queryRaw<Array<{ table_name: string; privilege: string; allowed: boolean }>>`
      SELECT c.relname AS table_name, p.privilege,
        has_table_privilege(current_user, c.oid, p.privilege) AS allowed
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) AS p(privilege)
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
        AND has_table_privilege(current_user, c.oid, p.privilege)
      ORDER BY c.relname, p.privilege
    `;
    if (violations.length) throw new Error("Runtime role received a forbidden TRUNCATE, TRIGGER, or REFERENCES privilege.");

    const tableStates = await runtimeDb.$queryRaw<Array<{
      table_name: string;
      rls: boolean;
      select_access: boolean;
      insert_access: boolean;
      update_access: boolean;
      delete_access: boolean;
      id_select_access: boolean;
      has_id: boolean;
    }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls,
        has_table_privilege(current_user, c.oid, 'SELECT') AS select_access,
        has_table_privilege(current_user, c.oid, 'INSERT') AS insert_access,
        has_table_privilege(current_user, c.oid, 'UPDATE') AS update_access,
        has_table_privilege(current_user, c.oid, 'DELETE') AS delete_access,
        CASE WHEN a.attname IS NOT NULL THEN has_column_privilege(current_user, c.oid, 'id', 'SELECT') ELSE false END AS id_select_access,
        (a.attname IS NOT NULL) AS has_id
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='id' AND NOT a.attisdropped
      WHERE n.nspname='public' AND c.relkind IN ('r','p')
      ORDER BY c.relname
    `;
    const expectedGrants = new Map(grants.map(({ table, privileges }) => [table, new Set<string>(privileges)]));
    const actualTables = new Map(tableStates.map((table) => [table.table_name, table]));
    if (grants.some(({ table }) => !actualTables.has(table))) {
      throw new Error("A required runtime table is missing from the staging schema.");
    }
    for (const table of tableStates) {
      const expected = expectedGrants.get(table.table_name) || new Set<string>();
      const expectedColumnSelect = grants.find((grant) => grant.table === table.table_name)?.columnSelect || [];
      if (
        !table.rls ||
        table.select_access !== expected.has("SELECT") ||
        table.insert_access !== expected.has("INSERT") ||
        table.update_access !== expected.has("UPDATE") ||
        table.delete_access !== expected.has("DELETE") ||
        table.id_select_access !== (table.has_id && (expected.has("SELECT") || expectedColumnSelect.includes("id")))
      ) {
        throw new Error(`Runtime table grants or RLS do not match the least-privilege matrix for ${table.table_name}.`);
      }
    }

    const childEnv = {
      ...process.env,
      AFFILIATE_STAGING_RUNTIME_DATABASE_URL: runtimeUrl,
      AFFILIATE_STAGING_DATABASE_URL: stageUrl,
      AFFILIATE_STAGING_DIRECT_URL: directUrl,
      AFFILIATE_STAGING_PROJECT_REF: expectedRef,
    };
    const affiliatePassed = runNpm(["run", "test:affiliate", "-w", "apps/api"], childEnv, urls);
    testResults.push({ name: "affiliate database integration suite", passed: affiliatePassed });

    const fullEnv = {
      ...childEnv,
      DATABASE_URL: runtimeUrl,
      DIRECT_URL: directUrl,
    };
    // The database suite already ran directly above. Avoid running that same
    // network-heavy suite a second time inside the complete workspace test
    // command, which can saturate the shared staging pooler. All other tests
    // still execute against the restricted runtime credential.
    const templateTestsPassed = runNpm(["run", "test", "-w", "packages/template-engine"], fullEnv, urls);
    const apiTestsPassed = runNpm([
      "run", "test", "-w", "apps/api", "--", "--exclude", "src/__tests__/affiliate.staging.integration.test.ts",
    ], fullEnv, urls);
    const fullPassed = templateTestsPassed && apiTestsPassed;
    testResults.push({ name: "full application test suite", passed: fullPassed });

    const buildPassed = runNpm(["run", "build"], fullEnv, urls);
    testResults.push({ name: "production build", passed: buildPassed });
  } finally {
    if (runtimeDb) await runtimeDb.$disconnect().catch(() => undefined);
    if (privilegeRoleCreated || runtimeRoleCreated) {
      for (const { table } of grants) {
        try {
          await adminDb.$executeRawUnsafe(`DROP POLICY IF EXISTS "${POLICY_NAME}" ON public."${table}"`);
          await adminDb.$executeRawUnsafe(`REVOKE ALL PRIVILEGES ON TABLE public."${table}" FROM "${PRIVILEGE_ROLE}"`);
          const columnSelect = grants.find((grant) => grant.table === table)?.columnSelect || [];
          if (columnSelect.length) {
            await adminDb.$executeRawUnsafe(
              `REVOKE SELECT (${columnSelect.map((column) => `"${column}"`).join(", ")}) ON TABLE public."${table}" FROM "${PRIVILEGE_ROLE}"`,
            );
          }
        } catch {
          cleanupFailure = true;
        }
      }
      try {
        if (runtimeRoleCreated) {
          await adminDb.$executeRawUnsafe(`REVOKE "${PRIVILEGE_ROLE}" FROM "${ROLE_NAME}"`);
          await adminDb.$executeRawUnsafe(`DROP ROLE IF EXISTS "${ROLE_NAME}"`);
        }
      } catch {
        cleanupFailure = true;
      }
      try {
        if (privilegeRoleCreated) {
          await adminDb.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM "${PRIVILEGE_ROLE}"`);
          await adminDb.$executeRawUnsafe(`REVOKE CONNECT ON DATABASE "postgres" FROM "${PRIVILEGE_ROLE}"`);
          await adminDb.$executeRawUnsafe(`DROP ROLE IF EXISTS "${PRIVILEGE_ROLE}"`);
        }
      } catch {
        cleanupFailure = true;
      }
      const residue = await adminDb.$queryRaw<Array<{ role_exists: boolean; policies_left: number }>>`
        SELECT (EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${ROLE_NAME}) OR
          EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${PRIVILEGE_ROLE})) AS role_exists,
          (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND policyname = ${POLICY_NAME}) AS policies_left
      `;
      if (residue[0]?.role_exists || residue[0]?.policies_left !== 0) cleanupFailure = true;
    }
    await adminDb.$disconnect();
  }

  if (cleanupFailure) throw new Error("Temporary staging runtime role cleanup could not be verified; manual staging cleanup is required.");

  for (const result of testResults) {
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.name}`);
  }
  if (testResults.length !== 3 || testResults.some(({ passed }) => !passed)) {
    throw new Error("Staging least-privilege runtime validation did not fully pass.");
  }
  console.log(`Staging least-privilege runtime role validation finished for isolated project ${EXPECTED_STAGING_REF}; temporary role and policies were removed.`);
}

main().catch((error) => {
  const message = String(error?.message || "Staging runtime role validation failed.");
  const secrets = [
    process.env.AFFILIATE_STAGING_DATABASE_URL,
    process.env.AFFILIATE_STAGING_DIRECT_URL,
    process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
  ].filter(Boolean) as string[];
  secrets.push(...dynamicSecrets);
  console.error(redact(message, secrets));
  process.exitCode = 1;
});
