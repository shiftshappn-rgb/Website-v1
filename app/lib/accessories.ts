export const ACCESSORIES_CATEGORY_SLUG = "accessories";

export const ACCESSORY_DEFAULT_COLOR = "Default";
export const ACCESSORY_DEFAULT_COLOR_HEX = "#C4C4C4";
export const ACCESSORY_DEFAULT_SIZE = "One Size";

export function isAccessoriesCategory(
  category: { slug: string } | null | undefined
): boolean {
  return category?.slug === ACCESSORIES_CATEGORY_SLUG;
}

export function isDefaultAccessoryVariant(variant: {
  colorName: string;
  size: string;
}): boolean {
  return (
    variant.colorName === ACCESSORY_DEFAULT_COLOR &&
    variant.size === ACCESSORY_DEFAULT_SIZE
  );
}

/** Single colour + single size — hide pickers on the storefront. */
export function isSimpleAccessorySku(variants: Array<{ colorName: string; size: string }>) {
  if (variants.length !== 1) return false;
  const colors = new Set(variants.map((variant) => variant.colorName));
  const sizes = new Set(variants.map((variant) => variant.size));
  return colors.size === 1 && sizes.size === 1;
}
