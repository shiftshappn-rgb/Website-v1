/** Shared isomorphic validation primitives (no Node-only APIs). */

export type FieldErrors = Record<string, string>;

export function hasFieldErrors(fieldErrors: FieldErrors): boolean {
  return Object.keys(fieldErrors).length > 0;
}

export const MAX_LINE_QTY = 20;
export const MAX_CART_LINES = 50;
export const MIN_GIFT_CARD_AMOUNT = 10;
export const MAX_GIFT_CARD_AMOUNT = 1000;
export const MAX_GIFT_NOTE_LENGTH = 500;
export const MAX_NAME_LENGTH = 100;
export const MAX_ADDRESS_LINE = 120;
export const MAX_CITY_LENGTH = 80;
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_ADDRESS_COUNT = 10;

export const CA_PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

export type CaProvince = (typeof CA_PROVINCES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CA_POSTAL_RE = /^[A-Z]\d[A-Z][ ]?\d[A-Z]\d$/;
const NANP_RE = /^\+?1?[\s.-]?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})$/;
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function trimToMax(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function parseIntStrict(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) return null;
    return raw;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function clampQuantity(
  qty: unknown,
  opts: { min?: number; max?: number } = {}
): number | null {
  const min = opts.min ?? 1;
  const max = opts.max ?? MAX_LINE_QTY;
  const n =
    typeof qty === "number" && Number.isFinite(qty)
      ? Math.trunc(qty)
      : parseIntStrict(qty);
  if (n == null) return null;
  if (n < min || n > max) return null;
  return n;
}

export function normalizeCanadianPostalCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return null;
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export function isCanadianPostalCode(raw: string): boolean {
  return normalizeCanadianPostalCode(raw) != null || CA_POSTAL_RE.test(raw.trim().toUpperCase());
}

export function normalizeProvince(raw: string): CaProvince | null {
  const code = raw.trim().toUpperCase();
  return (CA_PROVINCES as readonly string[]).includes(code)
    ? (code as CaProvince)
    : null;
}

/** Returns digits-only NANP national number (10 digits) or null. */
export function normalizeNanpPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : null;
  if (!national) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null;
  return national;
}

export function validatePhone(
  phone: string,
  country = "CA"
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { ok: false, error: "Phone number is required." };
  }
  const upper = country.trim().toUpperCase() || "CA";
  if (upper === "CA" || upper === "US") {
    const national = normalizeNanpPhone(trimmed);
    if (!national && !NANP_RE.test(trimmed)) {
      return { ok: false, error: "Enter a valid North American phone number." };
    }
    const digits = national ?? normalizeNanpPhone(trimmed);
    if (!digits) {
      return { ok: false, error: "Enter a valid North American phone number." };
    }
    return { ok: true, value: `+1${digits}` };
  }
  return { ok: false, error: "Unsupported phone country." };
}

export type AddressInput = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
};

export type ValidatedAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone?: string;
};

export function validateAddress(
  input: AddressInput,
  opts: { requirePhone?: boolean; requireName?: boolean } = {}
): { ok: true; value: ValidatedAddress } | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const requireName = opts.requireName ?? true;
  const requirePhone = opts.requirePhone ?? false;

  const name = (input.name ?? "").trim();
  const line1 = (input.line1 ?? "").trim();
  const line2 = (input.line2 ?? "").trim();
  const city = (input.city ?? "").trim();
  const provinceRaw = (input.province ?? "").trim();
  const postalRaw = (input.postalCode ?? "").trim();
  const country = ((input.country ?? "CA").trim().toUpperCase() || "CA");
  const phoneRaw = (input.phone ?? "").trim();

  if (requireName) {
    if (!name) fieldErrors.name = "Name is required.";
    else if (name.length > MAX_NAME_LENGTH) {
      fieldErrors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
    }
  } else if (name.length > MAX_NAME_LENGTH) {
    fieldErrors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  }

  if (!line1) fieldErrors.line1 = "Address line is required.";
  else if (line1.length > MAX_ADDRESS_LINE) {
    fieldErrors.line1 = `Address must be at most ${MAX_ADDRESS_LINE} characters.`;
  }

  if (line2.length > MAX_ADDRESS_LINE) {
    fieldErrors.line2 = `Address line 2 must be at most ${MAX_ADDRESS_LINE} characters.`;
  }

  if (!city) fieldErrors.city = "City is required.";
  else if (city.length > MAX_CITY_LENGTH) {
    fieldErrors.city = `City must be at most ${MAX_CITY_LENGTH} characters.`;
  }

  const province = normalizeProvince(provinceRaw);
  if (!provinceRaw) fieldErrors.province = "Province is required.";
  else if (!province) fieldErrors.province = "Enter a valid Canadian province or territory.";

  const postalCode = normalizeCanadianPostalCode(postalRaw);
  if (!postalRaw) fieldErrors.postalCode = "Postal code is required.";
  else if (!postalCode) fieldErrors.postalCode = "Enter a valid Canadian postal code (e.g. B3H 1A1).";

  if (country !== "CA") {
    fieldErrors.country = "We currently ship within Canada only.";
  }

  let phone: string | undefined;
  if (requirePhone || phoneRaw) {
    const phoneResult = validatePhone(phoneRaw || "", country);
    if (!phoneResult.ok) {
      if (requirePhone || phoneRaw) fieldErrors.phone = phoneResult.error;
    } else {
      phone = phoneResult.value;
    }
  }

  if (hasFieldErrors(fieldErrors)) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      name: name || "",
      line1,
      line2,
      city,
      province: province!,
      postalCode: postalCode!,
      country: "CA",
      ...(phone ? { phone } : {}),
    },
  };
}

export function validateName(
  name: string,
  opts: { required?: boolean } = {}
): string | null {
  const required = opts.required ?? true;
  const trimmed = name.trim();
  if (!trimmed) {
    return required ? "Name is required." : null;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  }
  return null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedImageHost(
  value: string,
  allowedHosts: string[] = ["res.cloudinary.com"]
): boolean {
  if (!isHttpUrl(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return allowedHosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

export function isValidHhMm(value: string): boolean {
  return TIME_HHMM_RE.test(value.trim());
}

export function compareHhMm(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}
