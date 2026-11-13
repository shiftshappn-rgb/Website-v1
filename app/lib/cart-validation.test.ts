import { describe, expect, it } from "vitest";
import {
  giftCardLineKey,
  sanitizeCartItems,
  validateCartItemsInput,
  validateGiftCardAdd,
} from "~/lib/cart-validation";

describe("cart validation", () => {
  it("sanitizes corrupt cart items", () => {
    const items = sanitizeCartItems([
      {
        variantId: "v1",
        productId: "p1",
        productName: "Top",
        variantLabel: "Navy / M",
        colorHex: "#000",
        price: 80,
        quantity: 2,
      },
      { variantId: "bad", quantity: -1 },
      {
        kind: "gift_card",
        variantId: "gc",
        productId: "gift-card",
        productName: "Gift",
        variantLabel: "E-gift",
        colorHex: "#5ca8d6",
        price: 50,
        quantity: 1,
        giftAmount: 50,
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.quantity).toBe(2);
    expect(items[1]?.kind).toBe("gift_card");
  });

  it("rejects empty carts and invalid gift emails", () => {
    expect(validateCartItemsInput([]).ok).toBe(false);
    const invalidGift = validateCartItemsInput([
      {
        kind: "gift_card",
        variantId: "gc",
        productId: "gift-card",
        productName: "Gift",
        variantLabel: "E-gift",
        colorHex: "#5ca8d6",
        price: 50,
        quantity: 1,
        giftAmount: 50,
        recipientEmail: "not-an-email",
      },
    ]);
    expect(invalidGift.ok).toBe(false);
  });

  it("validates gift card add inputs", () => {
    expect(validateGiftCardAdd({ amount: 5 }).ok).toBe(false);
    expect(
      validateGiftCardAdd({
        amount: 50,
        denominations: [50, 100],
        quantity: 2,
        recipientEmail: "friend@example.com",
      }).ok
    ).toBe(true);
  });

  it("builds stable gift line keys for long notes", () => {
    const note = "a".repeat(80);
    const a = giftCardLineKey(50, "a@b.co", note);
    const b = giftCardLineKey(50, "a@b.co", note + "x");
    expect(a).not.toBe(b);
  });
});
