import { describe, expect, it } from "vitest";
import {
  clampQuantity,
  isCanadianPostalCode,
  isValidEmail,
  normalizeCanadianPostalCode,
  normalizeEmail,
  parseIntStrict,
  parseMoney,
  validateAddress,
  validatePhone,
} from "~/lib/validation";

describe("validation primitives", () => {
  it("validates emails", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(normalizeEmail("  A@B.CO ")).toBe("a@b.co");
  });

  it("parses ints and money strictly", () => {
    expect(parseIntStrict("12")).toBe(12);
    expect(parseIntStrict("12.5")).toBeNull();
    expect(parseMoney("9.95")).toBe(9.95);
    expect(parseMoney("abc")).toBeNull();
  });

  it("clamps quantities", () => {
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(0)).toBeNull();
    expect(clampQuantity(21)).toBeNull();
    expect(clampQuantity(2.7)).toBe(2);
  });

  it("normalizes Canadian postal codes", () => {
    expect(normalizeCanadianPostalCode("b3h1a1")).toBe("B3H 1A1");
    expect(isCanadianPostalCode("B3H 1A1")).toBe(true);
    expect(normalizeCanadianPostalCode("12345")).toBeNull();
  });

  it("validates NANP phones", () => {
    expect(validatePhone("(902) 555-0100").ok).toBe(true);
    expect(validatePhone("555").ok).toBe(false);
  });

  it("validates addresses", () => {
    const ok = validateAddress(
      {
        name: "Alex Nurse",
        line1: "123 Spring Garden Rd",
        city: "Halifax",
        province: "NS",
        postalCode: "b3h1a1",
        country: "CA",
        phone: "9025550100",
      },
      { requirePhone: true }
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.postalCode).toBe("B3H 1A1");
      expect(ok.value.phone).toBe("+19025550100");
    }

    const bad = validateAddress(
      {
        name: "",
        line1: "",
        city: "",
        province: "XX",
        postalCode: "000",
        country: "US",
      },
      { requirePhone: true }
    );
    expect(bad.ok).toBe(false);
  });
});
