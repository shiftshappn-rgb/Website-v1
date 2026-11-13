import { describe, expect, it } from "vitest";
import { computeShippingCost } from "~/lib/checkout-pricing.server";

describe("computeShippingCost", () => {
  it("is free for gift-cards-only and hospital/clinic", () => {
    expect(
      computeShippingCost({
        isGiftCardsOnly: true,
        isHospitalOrClinic: false,
        freeDelivery: false,
        shippingMethod: "standard",
        merchandiseSubtotal: 20,
        freeShippingDiscount: false,
      })
    ).toBe(0);

    expect(
      computeShippingCost({
        isGiftCardsOnly: false,
        isHospitalOrClinic: true,
        freeDelivery: false,
        shippingMethod: "hospital_free",
        merchandiseSubtotal: 20,
        freeShippingDiscount: false,
      })
    ).toBe(0);
  });

  it("applies express, free threshold, and free_shipping promo", () => {
    expect(
      computeShippingCost({
        isGiftCardsOnly: false,
        isHospitalOrClinic: false,
        freeDelivery: false,
        shippingMethod: "express",
        merchandiseSubtotal: 50,
        freeShippingDiscount: false,
      })
    ).toBe(15);

    expect(
      computeShippingCost({
        isGiftCardsOnly: false,
        isHospitalOrClinic: false,
        freeDelivery: false,
        shippingMethod: "standard",
        merchandiseSubtotal: 100,
        freeShippingDiscount: false,
      })
    ).toBe(0);

    expect(
      computeShippingCost({
        isGiftCardsOnly: false,
        isHospitalOrClinic: false,
        freeDelivery: false,
        shippingMethod: "standard",
        merchandiseSubtotal: 40,
        freeShippingDiscount: false,
      })
    ).toBe(9.95);

    expect(
      computeShippingCost({
        isGiftCardsOnly: false,
        isHospitalOrClinic: false,
        freeDelivery: false,
        shippingMethod: "standard",
        merchandiseSubtotal: 40,
        freeShippingDiscount: true,
      })
    ).toBe(0);
  });
});
