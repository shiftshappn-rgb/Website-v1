import {
  MAX_PASSWORD_LENGTH,
  hasFieldErrors as hasAnyFieldErrors,
  isValidEmail,
  normalizeEmail,
  validateName,
  type FieldErrors,
} from "~/lib/validation";

export type AuthFieldErrors = {
  email?: string;
  password?: string;
  name?: string;
  confirmPassword?: string;
};

export { isValidEmail, normalizeEmail };

/** Returns null when the password meets create-account strength rules. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  return null;
}

export function validateLoginFields({
  email,
  password,
}: {
  email: string;
  password: string;
}): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  }

  return fieldErrors;
}

export function validateRegisterFields({
  email,
  password,
  name,
  confirmPassword,
}: {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
}): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (name !== undefined) {
    const nameError = validateName(name, { required: false });
    if (nameError) fieldErrors.name = nameError;
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  } else {
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      fieldErrors.password = strengthError;
    }
  }

  if (confirmPassword !== undefined) {
    if (!confirmPassword) {
      fieldErrors.confirmPassword = "Confirm your password.";
    } else if (confirmPassword !== password) {
      fieldErrors.confirmPassword = "Passwords do not match.";
    }
  }

  return fieldErrors;
}

export function hasFieldErrors(fieldErrors: AuthFieldErrors | FieldErrors): boolean {
  return hasAnyFieldErrors(fieldErrors);
}
