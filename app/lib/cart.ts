import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  giftAmount?: number;
  recipientEmail?: string;
  giftNote?: string;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  addGiftCard: (item: {
    amount: number;
    recipientEmail?: string;
    giftNote?: string;
    quantity?: number;
  }) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
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

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        set((state) => {
          const normalized = normalizeItem({
            ...item,
            kind: item.kind ?? "product",
          });
          const existing = state.items.find(
            (i) => i.variantId === normalized.variantId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === normalized.variantId
                  ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
                  : i
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              { ...normalized, quantity: item.quantity ?? 1 },
            ],
            isOpen: true,
          };
        });
      },

      addGiftCard: ({ amount, recipientEmail, giftNote, quantity = 1 }) => {
        const recipient = recipientEmail?.trim() || undefined;
        const note = giftNote?.trim() || undefined;
        const variantId = `gift-card-${amount}-${recipient?.toLowerCase() || "self"}-${note?.slice(0, 32) || ""}`;

        get().addItem({
          kind: "gift_card",
          variantId,
          productId: "gift-card",
          productName: "ShiftsHappn e-gift card",
          variantLabel: recipient
            ? `E-gift · $${amount} · to ${recipient}`
            : `E-gift · $${amount}`,
          colorHex: "#5ca8d6",
          price: amount,
          quantity,
          giftAmount: amount,
          recipientEmail: recipient,
          giftNote: note,
        });
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      subtotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      hasGiftCards: () =>
        get().items.some((item) => (item.kind ?? "product") === "gift_card"),

      hasProducts: () =>
        get().items.some((item) => (item.kind ?? "product") === "product"),

      isGiftCardsOnly: () => {
        const items = get().items;
        return items.length > 0 && items.every((item) => item.kind === "gift_card");
      },
    }),
    { name: "shiftshappn-cart" }
  )
);
