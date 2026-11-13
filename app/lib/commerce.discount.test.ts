import { describe, expect, it } from "vitest";
import { computeDiscountAmount } from "~/lib/commerce.server";

describe("computeDiscountAmount", () => {
  it("applies percent discounts capped at subtotal", () => {
    expect(computeDiscountAmount("percent", 10, 100, 9.95)).toBe(10);
    expect(computeDiscountAmount("percent", 150, 40, 0)).toBe(40);
  });

  it("applies fixed discounts capped at subtotal", () => {
    expect(computeDiscountAmount("fixed", 15, 100, 9.95)).toBe(15);
    expect(computeDiscountAmount("fixed", 150, 40, 0)).toBe(40);
  });

  it("returns shipping for free_shipping type", () => {
    expect(computeDiscountAmount("free_shipping", 0, 80, 9.95)).toBe(9.95);
  });
});
