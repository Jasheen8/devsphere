import { describe, expect, it } from "vitest";
import { calculateBloomAnniversaryPackage } from "../lib/fulfillment.js";

describe("Anniversary Bloom checkout pricing", () => {
  it.each([
    { movieEnabled: false, revealMethod: "NORMAL" as const, expected: 449 },
    { movieEnabled: true, revealMethod: "NORMAL" as const, expected: 459 },
    { movieEnabled: false, revealMethod: "QR" as const, expected: 459 },
    { movieEnabled: true, revealMethod: "QR" as const, expected: 469 },
  ])("calculates the expected package total", ({ movieEnabled, revealMethod, expected }) => {
    const pricing = calculateBloomAnniversaryPackage({
      projectData: { movieEnabled },
      revealMethod,
      currency: "INR",
    });

    expect(pricing.basePackagePrice).toBe(449);
    expect(pricing.packagePrice).toBe(expected);
    expect(pricing.providerAmount).toBe(expected);
    expect(pricing.providerAmountMinor).toBe(expected * 100);
  });

  it("rejects USD so the INR amounts cannot be silently converted", () => {
    expect(() => calculateBloomAnniversaryPackage({
      projectData: { movieEnabled: false },
      revealMethod: "NORMAL",
      currency: "USD",
    })).toThrow("available in INR only");
  });
});
