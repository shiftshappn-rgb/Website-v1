import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type AddressInput = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
};

export type CartItem = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  colorHex: string;
  price: number;
  quantity: number;
  imagePublicId?: string;
  imageAlt?: string;
  kind?: "product" | "gift_card";
  giftAmount?: number;
  recipientEmail?: string;
  giftNote?: string;
};

export type Phase1Data = {
  accountChoice: "guest" | "login" | "register";
  email: string;
  customerId?: string;
  promoCode?: string;
  giftCardCode?: string;
  discountAmount: number;
  giftCardAmount: number;
  subtotal: number;
  hasGiftCards: boolean;
  hasProducts: boolean;
};

export type Phase2Data = {
  deliveryLocationId: string;
  deliveryTimeSlotId: string;
  shippingMethod: "hospital_free" | "standard" | "express";
  shippingCost: number;
  billingAddress: AddressInput;
  deliveryLocationName?: string;
  deliveryLocationType?: string;
  deliveryTimeSlotLabel?: string;
  deliveryDate?: string;
};

export type Phase3Data = {
  paymentMethodId?: string;
  paymentIntentId?: string;
  stripeClientSecret?: string;
};

export type CheckoutFormData = {
  phase: 1 | 2 | 3;
  phase1: Phase1Data | null;
  phase2: Phase2Data | null;
  phase3: Phase3Data | null;
  cartItems: CartItem[];
};

const STORAGE_KEY = "shiftshappn-checkout";

const initialState: CheckoutFormData = {
  phase: 1,
  phase1: null,
  phase2: null,
  phase3: null,
  cartItems: [],
};

function loadFromStorage(): CheckoutFormData {
  if (typeof window === "undefined") return initialState;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...initialState, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return initialState;
}

function saveToStorage(data: CheckoutFormData) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

const CheckoutContext = createContext<{
  formData: CheckoutFormData;
  hydrated: boolean;
  updateField: <K extends keyof CheckoutFormData>(key: K, value: CheckoutFormData[K]) => void;
  updatePhase1: (data: Partial<Phase1Data>) => void;
  updatePhase2: (data: Partial<Phase2Data>) => void;
  updatePhase3: (data: Partial<Phase3Data>) => void;
  setCartItems: (items: CartItem[]) => void;
  nextPhase: () => void;
  prevPhase: () => void;
  goToPhase: (phase: 1 | 2 | 3) => void;
  clear: () => void;
  isComplete: () => boolean;
}>({
  formData: initialState,
  hydrated: false,
  updateField: () => {},
  updatePhase1: () => {},
  updatePhase2: () => {},
  updatePhase3: () => {},
  setCartItems: () => {},
  nextPhase: () => {},
  prevPhase: () => {},
  goToPhase: () => {},
  clear: () => {},
  isComplete: () => false,
});

export { CheckoutProvider as CartProvider };

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [formData, setFormData] = useState<CheckoutFormData>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFormData(loadFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveToStorage(formData);
    }
  }, [formData, hydrated]);

  const updateField = <K extends keyof CheckoutFormData>(key: K, value: CheckoutFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const updatePhase1 = (data: Partial<Phase1Data>) => {
    setFormData((prev) => ({
      ...prev,
      phase1: { ...prev.phase1, ...data } as Phase1Data,
      phase: Math.max(prev.phase, 1) as 1 | 2 | 3,
    }));
  };

  const updatePhase2 = (data: Partial<Phase2Data>) => {
    setFormData((prev) => ({
      ...prev,
      phase2: { ...prev.phase2, ...data } as Phase2Data,
      phase: Math.max(prev.phase, 2) as 1 | 2 | 3,
    }));
  };

  const updatePhase3 = (data: Partial<Phase3Data>) => {
    setFormData((prev) => ({
      ...prev,
      phase3: { ...prev.phase3, ...data } as Phase3Data,
      phase: Math.max(prev.phase, 3) as 1 | 2 | 3,
    }));
  };

  const setCartItems = (items: CartItem[]) => {
    setFormData((prev) => ({ ...prev, cartItems: items }));
  };

  const nextPhase = () => {
    setFormData((prev) => ({ ...prev, phase: Math.min(prev.phase + 1, 3) as 1 | 2 | 3 }));
  };

  const prevPhase = () => {
    setFormData((prev) => ({ ...prev, phase: Math.max(prev.phase - 1, 1) as 1 | 2 | 3 }));
  };

  const goToPhase = (phase: 1 | 2 | 3) => {
    setFormData((prev) => ({ ...prev, phase }));
  };

  const clear = () => {
    setFormData(initialState);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const isComplete = () => {
    return (
      formData.phase === 3 &&
      formData.phase1 !== null &&
      formData.phase2 !== null &&
      formData.cartItems.length > 0
    );
  };

  return (
    <CheckoutContext.Provider
      value={{
        formData,
        hydrated,
        updateField,
        updatePhase1,
        updatePhase2,
        updatePhase3,
        setCartItems,
        nextPhase,
        prevPhase,
        goToPhase,
        clear,
        isComplete,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error("useCheckout must be used within a CheckoutProvider");
  }
  return context;
}