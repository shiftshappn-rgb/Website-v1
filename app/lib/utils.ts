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
