import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  giftCardLineKey,
  sanitizeCartItems,
  validateGiftCardAdd,
  type CartActionResult,
  type SanitizedCartItem,
} from "~/lib/cart-validation";
import { MAX_LINE_QTY, clampQuantity } from "~/lib/validation";

export type CartItemKind = "product" | "gift_card";

export type CartItem = {
  kind?: CartItemKind;
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

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (
    item: Omit<CartItem, "quantity"> & { quantity?: number }
  ) => CartActionResult;
  addSet: (
    lines: Array<Omit<CartItem, "quantity"> & { quantity?: number }>
  ) => CartActionResult;
  addPack: (
    lines: Array<Omit<CartItem, "quantity"> & { quantity?: number }>
  ) => CartActionResult;
  addGiftCard: (item: {
    amount: number;
    recipientEmail?: string;
    giftNote?: string;
    quantity?: number;
    denominations?: number[];
  }) => CartActionResult;
  removeItem: (variantId: string, setGroupId?: string, packGroupId?: string) => void;
  updateQuantity: (
    variantId: string,
    quantity: number,
    setGroupId?: string,
    packGroupId?: string
  ) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  subtotal: () => number;
  itemCount: () => number;
  hasGiftCards: () => boolean;
  hasProducts: () => boolean;
  isGiftCardsOnly: () => boolean;
};

function normalizeItem(
  item: Omit<CartItem, "quantity"> & { quantity?: number }
): Omit<CartItem, "quantity"> & { quantity?: number } {
  return {
    ...item,
    kind: item.kind ?? "product",
  };
}

function lineCap(item: { maxQty?: number }): number {
  if (item.maxQty != null && Number.isFinite(item.maxQty) && item.maxQty > 0) {
    return Math.min(MAX_LINE_QTY, Math.trunc(item.maxQty));
  }
  return MAX_LINE_QTY;
}

function mergeQty(existing: number, incoming: number, cap: number): number {
  return Math.min(cap, existing + incoming);
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const qty = clampQuantity(item.quantity ?? 1);
        if (qty == null) {
          return { ok: false, error: `Quantity must be between 1 and ${MAX_LINE_QTY}.` };
        }
        if (!Number.isFinite(item.price) || item.price < 0) {
          return { ok: false, error: "Invalid item price." };
        }
        if (!item.variantId?.trim() || !item.productId?.trim()) {
          return { ok: false, error: "Invalid product." };
        }

        const normalized = normalizeItem({ ...item, quantity: qty });
        const cap = lineCap(normalized);

        set((state) => {
          const existing = state.items.find(
            (i) =>
              !i.setGroupId &&
              !i.packGroupId &&
              !normalized.setGroupId &&
              !normalized.packGroupId &&
              i.variantId === normalized.variantId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                !i.setGroupId && !i.packGroupId && i.variantId === normalized.variantId
                  ? {
                      ...i,
                      quantity: mergeQty(i.quantity, qty, lineCap(i)),
                      maxQty: normalized.maxQty ?? i.maxQty,
                    }
                  : i
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              {
                ...normalized,
                quantity: Math.min(qty, cap),
              } as CartItem,
            ],
            isOpen: true,
          };
        });
        return { ok: true };
      },

      addGiftCard: ({ amount, recipientEmail, giftNote, quantity = 1, denominations }) => {
        const validated = validateGiftCardAdd({
          amount,
          recipientEmail,
          giftNote,
          quantity,
          denominations,
        });
        if (!validated.ok) return validated;

        const recipient = validated.recipient;
        const note = validated.note;
        const qty = validated.quantity ?? 1;
        const variantId = giftCardLineKey(amount, recipient, note);

        return get().addItem({
          kind: "gift_card",
          variantId,
          productId: "gift-card",
          productName: "ShiftsHappn e-gift card",
          variantLabel: recipient
            ? `E-gift · $${amount} · to ${recipient}`
            : `E-gift · $${amount}`,
          colorHex: "#5ca8d6",
          price: amount,
          quantity: qty,
          giftAmount: amount,
          recipientEmail: recipient,
          giftNote: note,
          maxQty: MAX_LINE_QTY,
        });
      },

      addSet: (lines) => {
        const groupId = lines[0]?.setGroupId;
        if (!groupId || lines.length < 2) {
          return { ok: false, error: "Incomplete scrub set." };
        }
        const added = clampQuantity(lines[0].quantity ?? 1);
        if (added == null) {
          return { ok: false, error: `Quantity must be between 1 and ${MAX_LINE_QTY}.` };
        }

        set((state) => {
          const existing = state.items.some(
            (item) => item.setGroupId === groupId && !item.packGroupId
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.setGroupId === groupId && !item.packGroupId
                  ? {
                      ...item,
                      quantity: mergeQty(item.quantity, added, lineCap(item)),
                    }
                  : item
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              ...lines.map((line) => {
                const qty = clampQuantity(line.quantity ?? added) ?? added;
                const cap = lineCap(line);
                return {
                  ...normalizeItem(line),
                  quantity: Math.min(qty, cap),
                } as CartItem;
              }),
            ],
            isOpen: true,
          };
        });
        return { ok: true };
      },

      addPack: (lines) => {
        const groupId = lines[0]?.packGroupId;
        if (!groupId || lines.length < 1) {
          return { ok: false, error: "Incomplete bundle." };
        }
        const added = clampQuantity(lines[0].quantity ?? 1);
        if (added == null) {
          return { ok: false, error: `Quantity must be between 1 and ${MAX_LINE_QTY}.` };
        }

        set((state) => {
          const existing = state.items.some((item) => item.packGroupId === groupId);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.packGroupId === groupId
                  ? {
                      ...item,
                      quantity: mergeQty(item.quantity, added, lineCap(item)),
                    }
                  : item
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              ...lines.map((line) => {
                const qty = clampQuantity(line.quantity ?? added) ?? added;
                const cap = lineCap(line);
                return {
                  ...normalizeItem(line),
                  quantity: Math.min(qty, cap),
                } as CartItem;
              }),
            ],
            isOpen: true,
          };
        });
        return { ok: true };
      },

      removeItem: (variantId, setGroupId, packGroupId) => {
        set((state) => ({
          items: state.items.filter((item) => {
            if (packGroupId) return item.packGroupId !== packGroupId;
            if (setGroupId) return Boolean(item.packGroupId) || item.setGroupId !== setGroupId;
            return (
              Boolean(item.packGroupId) ||
              Boolean(item.setGroupId) ||
              item.variantId !== variantId
            );
          }),
        }));
      },

      updateQuantity: (variantId, quantity, setGroupId, packGroupId) => {
        if (!Number.isFinite(quantity) || quantity <= 0) {
          get().removeItem(variantId, setGroupId, packGroupId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) => {
            const nextQty = Math.min(
              lineCap(item),
              Math.max(1, Math.trunc(quantity))
            );
            if (packGroupId) {
              return item.packGroupId === packGroupId
                ? { ...item, quantity: nextQty }
                : item;
            }
            if (setGroupId) {
              return !item.packGroupId && item.setGroupId === setGroupId
                ? { ...item, quantity: nextQty }
                : item;
            }
            return !item.setGroupId &&
              !item.packGroupId &&
              item.variantId === variantId
              ? { ...item, quantity: nextQty }
              : item;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      subtotal: () =>
        get().items.reduce((sum, item) => {
          const price = Number.isFinite(item.price) ? item.price : 0;
          const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
          return sum + price * qty;
        }, 0),

      itemCount: () =>
        get().items.reduce((sum, item) => {
          const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
          return sum + qty;
        }, 0),

      hasGiftCards: () =>
        get().items.some((item) => (item.kind ?? "product") === "gift_card"),

      hasProducts: () =>
        get().items.some((item) => (item.kind ?? "product") === "product"),

      isGiftCardsOnly: () => {
        const items = get().items;
        return items.length > 0 && items.every((item) => item.kind === "gift_card");
      },
    }),
    {
      name: "shiftshappn-cart",
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: unknown } | undefined;
        return {
          items: sanitizeCartItems(state?.items) as CartItem[],
          isOpen: false,
        };
      },
      merge: (persisted, current) => {
        const raw = persisted as Partial<CartState> | undefined;
        const items = sanitizeCartItems(raw?.items ?? current.items) as CartItem[];
        return {
          ...current,
          ...raw,
          items,
        };
      },
    }
  )
);

export type { SanitizedCartItem, CartActionResult };
