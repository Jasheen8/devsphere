import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

export const STAGING_CONFIRMATION = "I-CONFIRM-THIS-IS-A-SEPARATE-STAGING-PROJECT";

function databaseTargetFromUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const direct = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(parsed.hostname)?.[1];
    if (direct) return { projectRef: direct.toLowerCase(), hostname: parsed.hostname.toLowerCase() };

    // Pooler hosts are regional/shared, so their project identity comes from
    // the pooler-qualified username. Never trust a project-ref-looking suffix
    // in credentials on an arbitrary hostname.
    if (!/^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(parsed.hostname)) return null;
    const pooler = /(?:^|\.)([a-z0-9]{20})$/i.exec(decodeURIComponent(parsed.username))?.[1];
    return pooler
      ? { projectRef: pooler.toLowerCase(), hostname: parsed.hostname.toLowerCase() }
      : null;
  } catch {
    return null;
  }
}

export function validateStagingDatabaseTarget(args: {
  stageUrl?: string;
  directUrl?: string;
  expectedRef?: string;
  confirmation?: string;
  currentUrls?: string[];
}) {
  const stageUrl = args.stageUrl?.trim();
  const directUrl = args.directUrl?.trim();
  const expectedRef = args.expectedRef?.trim().toLowerCase();
  if (
    !stageUrl || !directUrl ||
    !expectedRef || !/^[a-z0-9]{20}$/.test(expectedRef) ||
    args.confirmation !== STAGING_CONFIRMATION
  ) {
    throw new Error("Set the isolated staging connection variables, project ref, and staging confirmation in apps/api/.env.staging.");
  }

  const stageTarget = databaseTargetFromUrl(stageUrl);
  const directTarget = databaseTargetFromUrl(directUrl);
  let stageConnection: URL;
  let directConnection: URL;
  try {
    stageConnection = new URL(stageUrl);
    directConnection = new URL(directUrl);
  } catch {
    throw new Error("Staging connection URLs must be valid PostgreSQL URLs.");
  }

  const isSupabasePooler = (hostname: string) => /^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(hostname);
  if (
    stageConnection.searchParams.get("sslmode") !== "require" ||
    directConnection.searchParams.get("sslmode") !== "require"
  ) {
    throw new Error("Both staging connection URLs must require SSL.");
  }
  if (
    !isSupabasePooler(stageConnection.hostname) ||
    stageConnection.port !== "6543" ||
    stageConnection.searchParams.get("pgbouncer")?.toLowerCase() !== "true"
  ) {
    throw new Error("AFFILIATE_STAGING_DATABASE_URL must use the Supabase transaction pooler on port 6543 with pgbouncer=true.");
  }
  if (!isSupabasePooler(directConnection.hostname) || directConnection.port !== "5432") {
    throw new Error("AFFILIATE_STAGING_DIRECT_URL must use the Supabase session pooler on port 5432 for migrations.");
  }
  if (
    !stageTarget || !directTarget ||
    stageTarget.projectRef !== expectedRef || directTarget.projectRef !== expectedRef
  ) {
    throw new Error("Staging connection URLs do not match AFFILIATE_STAGING_PROJECT_REF.");
  }

  for (const currentUrl of args.currentUrls || []) {
    const currentTarget = databaseTargetFromUrl(currentUrl);
    let currentHost = "";
    try {
      currentHost = new URL(currentUrl).hostname;
    } catch {
      // A malformed configured current URL is not allowed to weaken the ref check.
    }
    // Supabase poolers are shared by many projects in one region. A matching
    // pooler hostname alone is not evidence that the two URLs point to one DB.
    if (
      currentTarget?.projectRef === expectedRef ||
      (!currentTarget && currentHost && currentHost === stageTarget.hostname)
    ) {
      throw new Error("The staging target matches a currently configured database; refusing to run.");
    }
  }

  return { stageUrl, directUrl, expectedRef };
}

export function loadAndValidateStagingEnvironment() {
  const apiDir = path.resolve(process.cwd());
  dotenv.config({ path: path.resolve(apiDir, ".env"), override: false, quiet: true });
  dotenv.config({ path: path.resolve(apiDir, "../../.env"), override: false, quiet: true });

  const stagingFile = path.resolve(apiDir, ".env.staging");
  if (fs.existsSync(stagingFile)) {
    const staged = dotenv.parse(fs.readFileSync(stagingFile));
    for (const [key, value] of Object.entries(staged)) {
      if (key.startsWith("AFFILIATE_STAGING_")) process.env[key] = value;
    }
  }

  const configuredUrls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  return validateStagingDatabaseTarget({
    stageUrl: process.env.AFFILIATE_STAGING_DATABASE_URL,
    directUrl: process.env.AFFILIATE_STAGING_DIRECT_URL,
    expectedRef: process.env.AFFILIATE_STAGING_PROJECT_REF,
    confirmation: process.env.AFFILIATE_STAGING_CONFIRM,
    currentUrls: configuredUrls,
  });
}

export function validateStagingRuntimeDatabaseTarget(args: {
  runtimeUrl?: string;
  transactionUrl: string;
  expectedRef: string;
}) {
  const runtimeUrl = args.runtimeUrl?.trim();
  const expectedRef = args.expectedRef.trim().toLowerCase();
  if (!runtimeUrl) throw new Error("A staging runtime database URL is required for the least-privilege role test.");

  let runtime: URL;
  let transaction: URL;
  try {
    runtime = new URL(runtimeUrl);
    transaction = new URL(args.transactionUrl);
  } catch {
    throw new Error("Staging runtime and transaction URLs must be valid PostgreSQL URLs.");
  }
  const runtimeTarget = databaseTargetFromUrl(runtimeUrl);
  const transactionTarget = databaseTargetFromUrl(args.transactionUrl);
  const roleName = decodeURIComponent(runtime.username).split(".")[0].toLowerCase();
  if (!runtimeTarget || !transactionTarget || runtimeTarget.projectRef !== expectedRef || transactionTarget.projectRef !== expectedRef) {
    throw new Error("The staging runtime URL does not match the isolated staging project.");
  }
  if (
    !/^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(runtime.hostname) ||
    runtime.hostname.toLowerCase() !== transaction.hostname.toLowerCase() ||
    runtime.port !== "6543" ||
    runtime.searchParams.get("pgbouncer")?.toLowerCase() !== "true" ||
    runtime.searchParams.get("sslmode") !== "require"
  ) {
    throw new Error("The staging runtime URL must use the same SSL transaction pooler on port 6543.");
  }
  if (roleName !== "devsphere_app_runtime") {
    throw new Error("The staging runtime URL must use the devsphere_app_runtime role.");
  }
  return { runtimeUrl, expectedRef, roleName, hostname: runtime.hostname };
}
