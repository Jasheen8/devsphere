import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadAndValidateStagingEnvironment, validateStagingRuntimeDatabaseTarget } from "../src/lib/staging-safety.js";

try {
  const { stageUrl, directUrl, expectedRef } = loadAndValidateStagingEnvironment();
  const runtimeUrl = process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL
    ? validateStagingRuntimeDatabaseTarget({
      runtimeUrl: process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL,
      transactionUrl: stageUrl,
      expectedRef,
    }).runtimeUrl
    : stageUrl;
  console.log(
    `Staging target preflight passed for project ${expectedRef}; runtime role ${process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL ? "devsphere_app_runtime" : "configured staging role"}; pooler host ${new URL(stageUrl).hostname}; direct host ${new URL(directUrl).hostname}; target differs from configured application database.`,
  );
  const apiDir = path.resolve(process.cwd());
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error("Run this command through npm so it can use the repository test workflow.");

  const result = spawnSync(process.execPath, [npmExecPath, "run", "test", "--", "src/__tests__/affiliate.staging.integration.test.ts"], {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: runtimeUrl,
      DIRECT_URL: directUrl,
      AFFILIATE_STAGING_DATABASE_URL: stageUrl,
      AFFILIATE_STAGING_DIRECT_URL: directUrl,
      AFFILIATE_STAGING_PROJECT_REF: expectedRef,
      ...(process.env.AFFILIATE_STAGING_RUNTIME_DATABASE_URL
        ? { AFFILIATE_STAGING_RUNTIME_DATABASE_URL: runtimeUrl }
        : {}),
    },
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`
    .split(stageUrl).join("[redacted staging database URL]")
    .split(runtimeUrl).join("[redacted staging runtime database URL]")
    .split(directUrl).join("[redacted staging database URL]");
  if (output.trim()) process.stdout.write(output);
  if (result.error) throw new Error("Staging integration test process could not start.");
  if (result.status !== 0) throw new Error(`Database-backed staging tests failed for project ${expectedRef}.`);
  // Vitest prints both "Test Files …" and "Tests …" summaries. Match only
  // the latter so the wrapper validates the actual case count, not file count.
  const summaryLine = output.split(/\r?\n/).find((line) => /^\s*Tests\s/i.test(line)) || "";
  const passed = Number(/\b(\d+)\s+passed\b/i.exec(summaryLine)?.[1] || 0);
  const failed = Number(/\b(\d+)\s+failed\b/i.exec(summaryLine)?.[1] || 0);
  const skipped = Number(/\b(\d+)\s+skipped\b/i.exec(summaryLine)?.[1] || 0);
  const total = Number(/\((\d+)\)/.exec(summaryLine)?.[1] || 0);
  if (passed !== 13 || failed !== 0 || skipped !== 0 || total !== 13) {
    throw new Error(`Expected 13 executed database-backed tests; Vitest reported ${passed} passed, ${failed} failed, ${skipped} skipped, total ${total}.`);
  }
  console.log(`All 13 database-backed tests passed for isolated staging project ${expectedRef}.`);
} catch (error: any) {
  console.error(error?.message || "Staging tests did not run.");
  process.exitCode = 1;
}
