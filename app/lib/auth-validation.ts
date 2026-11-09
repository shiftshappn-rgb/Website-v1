export type AuthFieldErrors = {
  email?: string;
  password?: string;
  name?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Returns null when the password meets create-account strength rules. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
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
}: {
  email: string;
  password: string;
  name?: string;
}): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  } else {
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      fieldErrors.password = strengthError;
    }
  }

  return fieldErrors;
}

export function hasFieldErrors(fieldErrors: AuthFieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}
