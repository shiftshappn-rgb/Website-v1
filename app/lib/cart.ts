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
  setGroupId?: string;
  setRole?: "top" | "pants";
  packGroupId?: string;
  giftAmount?: number;
  recipientEmail?: string;
  giftNote?: string;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  addSet: (lines: Array<Omit<CartItem, "quantity"> & { quantity?: number }>) => void;
  addPack: (lines: Array<Omit<CartItem, "quantity"> & { quantity?: number }>) => void;
  addGiftCard: (item: {
    amount: number;
    recipientEmail?: string;
    giftNote?: string;
    quantity?: number;
  }) => void;
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

      addSet: (lines) => {
        const groupId = lines[0]?.setGroupId;
        if (!groupId || lines.length < 2) return;
        const added = lines[0].quantity ?? 1;
        set((state) => {
          const existing = state.items.some(
            (item) => item.setGroupId === groupId && !item.packGroupId
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.setGroupId === groupId && !item.packGroupId
                  ? { ...item, quantity: item.quantity + added }
                  : item
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              ...lines.map((line) => ({
                ...normalizeItem(line),
                quantity: line.quantity ?? 1,
              })),
            ],
            isOpen: true,
          };
        });
      },

      addPack: (lines) => {
        const groupId = lines[0]?.packGroupId;
        if (!groupId || lines.length < 1) return;
        const added = lines[0].quantity ?? 1;
        set((state) => {
          const existing = state.items.some((item) => item.packGroupId === groupId);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.packGroupId === groupId
                  ? { ...item, quantity: item.quantity + added }
                  : item
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              ...lines.map((line) => ({
                ...normalizeItem(line),
                quantity: line.quantity ?? 1,
              })),
            ],
            isOpen: true,
          };
        });
      },

      removeItem: (variantId, setGroupId, packGroupId) => {
        set((state) => ({
          items: state.items.filter((item) => {
            if (packGroupId) return item.packGroupId !== packGroupId;
            if (setGroupId) return Boolean(item.packGroupId) || item.setGroupId !== setGroupId;
            return Boolean(item.packGroupId) || Boolean(item.setGroupId) || item.variantId !== variantId;
          }),
        }));
      },

      updateQuantity: (variantId, quantity, setGroupId, packGroupId) => {
        if (quantity <= 0) {
          get().removeItem(variantId, setGroupId, packGroupId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) => {
            if (packGroupId) {
              return item.packGroupId === packGroupId ? { ...item, quantity } : item;
            }
            if (setGroupId) {
              return !item.packGroupId && item.setGroupId === setGroupId
                ? { ...item, quantity }
                : item;
            }
            return !item.setGroupId && !item.packGroupId && item.variantId === variantId
              ? { ...item, quantity }
              : item;
          }),
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

