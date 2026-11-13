import {
  MAX_CART_LINES,
  MAX_GIFT_CARD_AMOUNT,
  MAX_GIFT_NOTE_LENGTH,
  MAX_LINE_QTY,
  MIN_GIFT_CARD_AMOUNT,
  clampQuantity,
  isValidEmail,
  normalizeEmail,
  parseMoney,
  trimToMax,
} from "~/lib/validation";

export type CartItemLike = {
  kind?: "product" | "gift_card" | string;
  variantId?: unknown;
  productId?: unknown;
  productName?: unknown;
  variantLabel?: unknown;
  colorHex?: unknown;
  price?: unknown;
  quantity?: unknown;
  imagePublicId?: unknown;
  imageAlt?: unknown;
  setGroupId?: unknown;
  setRole?: unknown;
  packGroupId?: unknown;
  giftAmount?: unknown;
  recipientEmail?: unknown;
  giftNote?: unknown;
  maxQty?: unknown;
};

export type SanitizedCartItem = {
  kind: "product" | "gift_card";
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  colorHex: string;
  price: number;
  quantity: number;
  imagePublicId?: string;
  imageAlt?: string;
  setGroupId?: string;
  setRole?: "top" | "pants";
  packGroupId?: string;
  giftAmount?: number;
  recipientEmail?: string;
  giftNote?: string;
  maxQty?: number;
};

export type CartActionResult =
  | { ok: true }
  | { ok: false; error: string };

/** Stable short fingerprint so long gift notes don't collide on a 32-char prefix. */
export function giftCardLineKey(
  amount: number,
  recipientEmail?: string,
  giftNote?: string
): string {
  const recipient = (recipientEmail ?? "self").toLowerCase();
  const note = giftNote ?? "";
  let hash = 0;
  const seed = `${amount}|${recipient}|${note}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `gift-card-${amount}-${recipient.slice(0, 48)}-${hash.toString(36)}`;
}

export function sanitizeCartItem(raw: CartItemLike): SanitizedCartItem | null {
  const kind =
    raw.kind === "gift_card" ? "gift_card" : raw.kind === "product" || !raw.kind ? "product" : null;
  if (!kind) return null;

  const variantId = typeof raw.variantId === "string" ? raw.variantId.trim() : "";
  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";
  const productName =
    typeof raw.productName === "string" ? trimToMax(raw.productName, 200) : "";
  const variantLabel =
    typeof raw.variantLabel === "string" ? trimToMax(raw.variantLabel, 200) : "";
  const colorHex =
    typeof raw.colorHex === "string" && raw.colorHex.trim()
      ? raw.colorHex.trim()
      : "#cccccc";

  if (!variantId || !productId || !productName) return null;

  const quantity = clampQuantity(raw.quantity, { min: 1, max: MAX_LINE_QTY });
  if (quantity == null) return null;

  let price = parseMoney(raw.price);
  if (price == null || price < 0) return null;

  const maxQtyRaw = clampQuantity(raw.maxQty, { min: 1, max: MAX_LINE_QTY });
  const maxQty = maxQtyRaw ?? undefined;

  if (kind === "gift_card") {
    const giftAmount = parseMoney(raw.giftAmount ?? price);
    if (
      giftAmount == null ||
      giftAmount < MIN_GIFT_CARD_AMOUNT ||
      giftAmount > MAX_GIFT_CARD_AMOUNT
    ) {
      return null;
    }
    price = giftAmount;

    let recipientEmail: string | undefined;
    if (typeof raw.recipientEmail === "string" && raw.recipientEmail.trim()) {
      const email = normalizeEmail(raw.recipientEmail);
      if (!isValidEmail(email)) return null;
      recipientEmail = email;
    }

    const giftNote =
      typeof raw.giftNote === "string" && raw.giftNote.trim()
        ? trimToMax(raw.giftNote, MAX_GIFT_NOTE_LENGTH)
        : undefined;

    return {
      kind,
      variantId,
      productId: productId || "gift-card",
      productName: productName || "ShiftsHappn e-gift card",
      variantLabel,
      colorHex,
      price,
      quantity,
      giftAmount,
      recipientEmail,
      giftNote,
      ...(maxQty != null ? { maxQty } : {}),
    };
  }

  const setGroupId =
    typeof raw.setGroupId === "string" && raw.setGroupId.trim()
      ? raw.setGroupId.trim()
      : undefined;
  const packGroupId =
    typeof raw.packGroupId === "string" && raw.packGroupId.trim()
      ? raw.packGroupId.trim()
      : undefined;
  const setRole =
    raw.setRole === "top" || raw.setRole === "pants" ? raw.setRole : undefined;

  return {
    kind,
    variantId,
    productId,
    productName,
    variantLabel,
    colorHex,
    price,
    quantity: maxQty != null ? Math.min(quantity, maxQty) : quantity,
    imagePublicId:
      typeof raw.imagePublicId === "string" ? raw.imagePublicId : undefined,
    imageAlt: typeof raw.imageAlt === "string" ? raw.imageAlt : undefined,
    setGroupId,
    setRole,
    packGroupId,
    ...(maxQty != null ? { maxQty } : {}),
  };
}

export function sanitizeCartItems(items: unknown): SanitizedCartItem[] {
  if (!Array.isArray(items)) return [];
  const sanitized: SanitizedCartItem[] = [];
  for (const item of items.slice(0, MAX_CART_LINES)) {
    if (!item || typeof item !== "object") continue;
    const next = sanitizeCartItem(item as CartItemLike);
    if (next) sanitized.push(next);
  }
  return sanitized;
}

export function validateCartItemsInput(
  items: unknown,
  opts: { allowEmpty?: boolean } = {}
):
  | { ok: true; items: SanitizedCartItem[] }
  | { ok: false; error: string } {
  if (!Array.isArray(items)) {
    return { ok: false, error: "Invalid cart." };
  }
  if (items.length > MAX_CART_LINES) {
    return { ok: false, error: `Cart cannot exceed ${MAX_CART_LINES} lines.` };
  }

  const sanitized = sanitizeCartItems(items);
  if (!opts.allowEmpty && sanitized.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (sanitized.length !== items.length) {
    return { ok: false, error: "One or more cart items are invalid." };
  }

  for (const item of sanitized) {
    if (item.kind === "gift_card") {
      const amount = item.giftAmount ?? item.price;
      if (amount < MIN_GIFT_CARD_AMOUNT || amount > MAX_GIFT_CARD_AMOUNT) {
        return {
          ok: false,
          error: `Gift card amounts must be between $${MIN_GIFT_CARD_AMOUNT} and $${MAX_GIFT_CARD_AMOUNT}.`,
        };
      }
      if (item.recipientEmail && !isValidEmail(item.recipientEmail)) {
        return { ok: false, error: "Enter a valid gift recipient email." };
      }
    }
  }

  return { ok: true, items: sanitized };
}

export function validateGiftCardAdd(input: {
  amount: number;
  recipientEmail?: string;
  giftNote?: string;
  quantity?: number;
  denominations?: number[];
}): CartActionResult & { quantity?: number; note?: string; recipient?: string } {
  const amount = parseMoney(input.amount);
  if (amount == null || amount < MIN_GIFT_CARD_AMOUNT || amount > MAX_GIFT_CARD_AMOUNT) {
    return { ok: false, error: `Choose a gift card amount of at least $${MIN_GIFT_CARD_AMOUNT}.` };
  }
  if (input.denominations?.length && !input.denominations.includes(amount)) {
    return { ok: false, error: "Choose a valid gift card amount." };
  }

  const quantity = clampQuantity(input.quantity ?? 1);
  if (quantity == null) {
    return { ok: false, error: `Quantity must be between 1 and ${MAX_LINE_QTY}.` };
  }

  let recipient: string | undefined;
  if (input.recipientEmail?.trim()) {
    const email = normalizeEmail(input.recipientEmail);
    if (!isValidEmail(email)) {
      return { ok: false, error: "Enter a valid recipient email." };
    }
    recipient = email;
  }

  const note = input.giftNote?.trim()
    ? trimToMax(input.giftNote, MAX_GIFT_NOTE_LENGTH)
    : undefined;

  return { ok: true, quantity, note, recipient };
}
