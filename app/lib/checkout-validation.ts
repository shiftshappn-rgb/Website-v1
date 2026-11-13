import {
  validateLoginFields,
  validatePasswordStrength,
  validateRegisterFields,
  type AuthFieldErrors,
} from "~/lib/auth-validation";
import { validateCartItemsInput } from "~/lib/cart-validation";
import {
  hasFieldErrors,
  isValidEmail,
  normalizeEmail,
  validateAddress,
  validateName,
  type AddressInput,
  type FieldErrors,
  type ValidatedAddress,
} from "~/lib/validation";

export type CheckoutFieldErrors = FieldErrors & AuthFieldErrors;

export type Phase1AccountChoice = "guest" | "login" | "register";

export function validatePhase1Fields(input: {
  accountChoice: string;
  email: string;
  password?: string;
  name?: string;
  cartItems: unknown;
}): {
  fieldErrors: CheckoutFieldErrors;
  email: string;
  accountChoice: Phase1AccountChoice | null;
} {
  const fieldErrors: CheckoutFieldErrors = {};
  const accountChoiceRaw = input.accountChoice;
  const accountChoice: Phase1AccountChoice | null =
    accountChoiceRaw === "guest" ||
    accountChoiceRaw === "login" ||
    accountChoiceRaw === "register"
      ? accountChoiceRaw
      : null;

  if (!accountChoice) {
    fieldErrors.accountChoice = "Choose how you'd like to check out.";
  }

  const email = normalizeEmail(input.email ?? "");
  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (accountChoice === "login") {
    Object.assign(
      fieldErrors,
      validateLoginFields({ email, password: input.password ?? "" })
    );
  } else if (accountChoice === "register") {
    Object.assign(
      fieldErrors,
      validateRegisterFields({
        email,
        password: input.password ?? "",
        name: input.name,
      })
    );
    const nameError = validateName(input.name ?? "", { required: false });
    if (nameError) fieldErrors.name = nameError;
  }

  const cart = validateCartItemsInput(input.cartItems);
  if (!cart.ok) {
    fieldErrors.cart = cart.error;
  }

  return { fieldErrors, email, accountChoice };
}

export function validatePhase2Fields(input: {
  isGiftCardsOnly: boolean;
  deliveryLocationId?: string;
  deliveryLocationType?: string;
  deliveryTimeSlotId?: string;
  shippingMethod?: string;
  billingAddress?: AddressInput;
}): {
  fieldErrors: CheckoutFieldErrors;
  address?: ValidatedAddress;
} {
  const fieldErrors: CheckoutFieldErrors = {};

  if (input.isGiftCardsOnly) {
    return { fieldErrors };
  }

  const locationId = (input.deliveryLocationId ?? "").trim();
  if (!locationId) {
    fieldErrors.deliveryLocationId = "Choose a delivery location.";
  }

  const locationType = (input.deliveryLocationType ?? "").trim();
  const isHospitalOrClinic =
    locationType === "hospital" || locationType === "clinic";
  const isOther = locationType === "other" || locationId === "other-custom";

  const shippingMethod = (input.shippingMethod ?? "").trim();
  const allowedMethods = new Set(["hospital_free", "standard", "express"]);
  if (!allowedMethods.has(shippingMethod)) {
    fieldErrors.shippingMethod = "Choose a shipping method.";
  }

  if (isHospitalOrClinic) {
    if (!(input.deliveryTimeSlotId ?? "").trim()) {
      fieldErrors.deliveryTimeSlotId = "Choose a delivery time slot.";
    }
  }

  let address: ValidatedAddress | undefined;
  if (isOther) {
    const result = validateAddress(input.billingAddress ?? {}, {
      requirePhone: true,
      requireName: true,
    });
    if (!result.ok) {
      Object.assign(fieldErrors, result.fieldErrors);
    } else {
      address = result.value;
    }
  }

  return { fieldErrors, address };
}

export function validatePromoCodeInput(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (trimmed.length > 40) return "Promo code is too long.";
  return null;
}

export { hasFieldErrors, validatePasswordStrength };
