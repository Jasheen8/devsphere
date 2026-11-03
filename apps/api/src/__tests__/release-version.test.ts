import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { releaseGitSha } from "../lib/release-version.js";
import { app } from "../server.js";

let server: Server | undefined;

async function startApi() {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("public release version metadata", () => {
  it("accepts a short or full hexadecimal Git SHA", () => {
    expect(releaseGitSha("ABCDEF1")).toBe("abcdef1");
    expect(releaseGitSha("a".repeat(40))).toBe("a".repeat(40));
  });

  it("does not expose malformed values or environment configuration", () => {
    expect(releaseGitSha(undefined)).toBe("unknown");
    expect(releaseGitSha("release/production")).toBe("unknown");
    expect(releaseGitSha("postgresql://user:password@host/db")).toBe("unknown");
  });

  it("serves only the sanitized API SHA at the public version endpoint", async () => {
    vi.stubEnv("BUILD_GIT_SHA", "ABCDEF1");
    const response = await fetch(`${await startApi()}/version`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ service: "devsphere-api", gitSha: "abcdef1" });
  });

  it("serves unknown rather than exposing an invalid build value", async () => {
    vi.stubEnv("BUILD_GIT_SHA", "postgresql://user:password@host/db");
    const response = await fetch(`${await startApi()}/version`);
    expect(await response.json()).toEqual({ service: "devsphere-api", gitSha: "unknown" });
  });
});
