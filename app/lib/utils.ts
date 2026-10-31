import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCurrency(amount: number | string, currency = "CAD"): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SH-${timestamp}-${random}`;
}

export function getVariantPrice(
  basePrice: number,
  priceOverride?: number | null
): number {
  return priceOverride ?? basePrice;
}

export function getVariantLabel(
  colorName: string,
  size: string,
  length?: string | null
): string {
  // Keep cart labels clean for the accessory default SKU.
  if (colorName === "Default" && size === "One Size") {
    return length ? `One Size / ${length}` : "One Size";
  }
  return length ? `${colorName} / ${size} / ${length}` : `${colorName} / ${size}`;
}

export type VariantImage = {
  publicId: string;
  altText: string;
  sortOrder: number;
};

export function parseVariantImages(images: unknown): VariantImage[] {
  if (!Array.isArray(images)) return [];
  const result: VariantImage[] = [];

  for (let index = 0; index < images.length; index++) {
    const img = images[index];
    if (typeof img !== "object" || img === null) continue;
    const record = img as Record<string, unknown>;
    if (typeof record.publicId !== "string" || !record.publicId.trim()) continue;

    result.push({
      publicId: record.publicId.trim(),
      altText: typeof record.altText === "string" ? record.altText : "",
      sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
    });
  }

  return result.sort((a, b) => a.sortOrder - b.sortOrder);
}

const CARD_IMAGE_LIMIT = 6;

export function collectCardImages(
  groups: Array<Array<{ images: unknown }>>,
  fallbackAlt: string,
  limit = CARD_IMAGE_LIMIT
) {
  const seen = new Set<string>();
  const images: Array<{ publicId: string; alt: string }> = [];

  function add(image: VariantImage) {
    if (images.length >= limit) return;
    if (seen.has(image.publicId)) return;
    seen.add(image.publicId);
    images.push({ publicId: image.publicId, alt: image.altText || fallbackAlt });
  }

  const parsed = groups.map((variants) => variants.map((variant) => parseVariantImages(variant.images)));
  for (const list of parsed) {
    for (const variantImages of list) {
      if (variantImages[0]) add(variantImages[0]);
      if (images.length >= limit) return images;
    }
  }
  for (const list of parsed) {
    for (const variantImages of list) {
      for (const image of variantImages.slice(1)) {
        add(image);
        if (images.length >= limit) return images;
      }
    }
  }
  return images;
}

export function normalizeVariantImages(
  images: unknown,
  fallbackAlt = ""
): { images: VariantImage[]; error?: string } {
  let parsed: unknown = images;

  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) return { images: [] };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { images: [], error: "Images must be valid JSON." };
    }
  }

  if (parsed == null) return { images: [] };

  if (!Array.isArray(parsed)) {
    return { images: [], error: "Images must be an array." };
  }

  const result: VariantImage[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const img = parsed[i];
    if (typeof img !== "object" || img === null) {
      return { images: [], error: "Each image needs a Cloudinary public ID." };
    }
    const record = img as Record<string, unknown>;
    if (typeof record.publicId !== "string" || !record.publicId.trim()) {
      return { images: [], error: "Each image needs a Cloudinary public ID." };
    }

    const altText =
      typeof record.altText === "string" && record.altText.trim()
        ? record.altText.trim()
        : fallbackAlt;

    result.push({
      publicId: record.publicId.trim(),
      altText,
      sortOrder: i,
    });
  }

  return { images: result };
}

/** CTA fill + text contrast from a product colour swatch hex. */
export function ctaFromHex(hex?: string | null): {
  backgroundColor: string;
  color: string;
} {
  const fallback = "#111A22";
  const raw = (hex ?? "").trim();
  const withHash = raw.startsWith("#") ? raw : raw ? `#${raw}` : fallback;
  const digits = withHash.slice(1);
  const valid = /^[0-9a-fA-F]{6}$/.test(digits);
  const backgroundColor = valid ? `#${digits}` : fallback;
  const r = valid ? parseInt(digits.slice(0, 2), 16) : 17;
  const g = valid ? parseInt(digits.slice(2, 4), 16) : 26;
  const b = valid ? parseInt(digits.slice(4, 6), 16) : 34;
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return {
    backgroundColor,
    color: luminance > 165 ? "#111A22" : "#FFFFFF",
  };
}
