import { describe, expect, it } from "vitest";
import { STAGING_CONFIRMATION, validateStagingDatabaseTarget, validateStagingRuntimeDatabaseTarget } from "../lib/staging-safety.js";

const currentRef = "abcdefghijklmnopqrst";
const stageRef = "zyxwvutsrqponmlkjihg";
const poolerHost = "aws-0-ap-south-1.pooler.supabase.com";

function stageTarget(expectedRef = stageRef) {
  return {
    stageUrl: `postgresql://postgres.${stageRef}:staging-only@${poolerHost}:6543/postgres?pgbouncer=true&sslmode=require`,
    directUrl: `postgresql://postgres.${stageRef}:staging-only@${poolerHost}:5432/postgres?sslmode=require`,
    expectedRef,
    confirmation: STAGING_CONFIRMATION,
  };
}

describe("staging database safety guard", () => {
  it("allows a distinct staging project on the same regional Supabase pooler", () => {
    const target = stageTarget();
    expect(validateStagingDatabaseTarget({
      ...target,
      currentUrls: [`postgresql://postgres.${currentRef}:configured@${poolerHost}:6543/postgres`],
    })).toMatchObject({ expectedRef: stageRef });
  });

  it("refuses the currently configured Supabase project even if it uses another endpoint", () => {
    const target = stageTarget(currentRef);
    target.stageUrl = `postgresql://postgres.${currentRef}:stage@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`;
    target.directUrl = `postgresql://postgres.${currentRef}:stage@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`;
    expect(() => validateStagingDatabaseTarget({
      ...target,
      currentUrls: [`postgresql://postgres.${currentRef}:configured@${poolerHost}:6543/postgres`],
    })).toThrow(/matches a currently configured database/i);
  });

  it("refuses an unidentifiable current database on the same host", () => {
    const target = stageTarget();
    expect(() => validateStagingDatabaseTarget({
      ...target,
      currentUrls: [`postgresql://app:configured@${poolerHost}:6543/postgres`],
    })).toThrow(/matches a currently configured database/i);
  });

  it("refuses project-ref mismatches and missing explicit confirmation", () => {
    expect(() => validateStagingDatabaseTarget({
      ...stageTarget(currentRef),
      currentUrls: [],
    })).toThrow(/do not match/i);
    expect(() => validateStagingDatabaseTarget({
      ...stageTarget(),
      confirmation: "",
      currentUrls: [],
    })).toThrow(/confirmation/i);
  });

  it("refuses project-ref-looking credentials on an unrecognized database host", () => {
    const target = stageTarget();
    expect(() => validateStagingDatabaseTarget({
      ...target,
      stageUrl: `postgresql://postgres.${stageRef}:staging-only@db.attacker.example:6543/postgres?pgbouncer=true&sslmode=require`,
      currentUrls: [],
    })).toThrow(/transaction pooler/i);
  });

  it("requires the direct database host to identify the same staging project", () => {
    const target = stageTarget();
    expect(() => validateStagingDatabaseTarget({
      ...target,
      directUrl: `postgresql://postgres.${currentRef}:staging-only@${poolerHost}:5432/postgres?sslmode=require`,
      currentUrls: [],
    })).toThrow(/do not match/i);
  });

  it("requires SSL on both URLs, a transaction pooler on 6543, and a session pooler on 5432", () => {
    const target = stageTarget();
    expect(() => validateStagingDatabaseTarget({
      ...target,
      stageUrl: target.stageUrl.replace("&sslmode=require", ""),
      currentUrls: [],
    })).toThrow(/require SSL/i);
    expect(() => validateStagingDatabaseTarget({
      ...target,
      stageUrl: target.stageUrl.replace(":6543/", ":5432/"),
      currentUrls: [],
    })).toThrow(/transaction pooler/i);
    expect(() => validateStagingDatabaseTarget({
      ...target,
      directUrl: target.directUrl.replace(":5432/", ":6543/"),
      currentUrls: [],
    })).toThrow(/session pooler/i);
  });
});

describe("staging runtime role URL guard", () => {
  const transactionUrl = `postgresql://postgres.${stageRef}:admin@${poolerHost}:6543/postgres?pgbouncer=true&sslmode=require`;

  it("accepts the scoped runtime role only on the confirmed staging transaction pooler", () => {
    const runtimeUrl = `postgresql://devsphere_app_runtime.${stageRef}:runtime@${poolerHost}:6543/postgres?pgbouncer=true&sslmode=require`;
    expect(validateStagingRuntimeDatabaseTarget({ runtimeUrl, transactionUrl, expectedRef: stageRef })).toMatchObject({
      expectedRef: stageRef,
      roleName: "devsphere_app_runtime",
      hostname: poolerHost,
    });
  });

  it("rejects another project, role, port, hostname, or missing SSL", () => {
    const valid = `postgresql://devsphere_app_runtime.${stageRef}:runtime@${poolerHost}:6543/postgres?pgbouncer=true&sslmode=require`;
    expect(() => validateStagingRuntimeDatabaseTarget({ runtimeUrl: valid, transactionUrl, expectedRef: currentRef })).toThrow(/isolated staging project/i);
    expect(() => validateStagingRuntimeDatabaseTarget({ runtimeUrl: valid.replace("devsphere_app_runtime", "postgres"), transactionUrl, expectedRef: stageRef })).toThrow(/must use the devsphere_app_runtime/i);
    expect(() => validateStagingRuntimeDatabaseTarget({ runtimeUrl: valid.replace(":6543/", ":5432/"), transactionUrl, expectedRef: stageRef })).toThrow(/transaction pooler/i);
    expect(() => validateStagingRuntimeDatabaseTarget({ runtimeUrl: valid.replace("&sslmode=require", ""), transactionUrl, expectedRef: stageRef })).toThrow(/transaction pooler/i);
  });
});
