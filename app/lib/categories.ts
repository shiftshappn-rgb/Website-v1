export type CategoryLabelInput = {
  id?: string;
  name: string;
  slug: string;
  parentCategoryId?: string | null;
  parent?: { name: string; slug: string } | null;
};

/** Display label with parent path, e.g. "Women › Scrub Tops". */
export function categoryPathLabel(category: {
  name: string;
  parent?: { name: string } | null;
  parentName?: string | null;
}): string {
  const parentName = category.parent?.name ?? category.parentName ?? null;
  if (parentName) return `${parentName} › ${category.name}`;
  return category.name;
}

/** Scrub products need a leaf (tops/pants); accessories may be the root. */
export function isAssignableProductCategory(category: {
  slug: string;
  parentCategoryId?: string | null;
  parent?: { id?: string } | null;
}): boolean {
  if (category.slug === "accessories") return true;
  return Boolean(category.parentCategoryId ?? category.parent?.id);
}

export function audienceFromCategory(category: {
  slug: string;
  parent?: { slug: string; name?: string } | null;
} | null): "Women" | "Men" | null {
  const slug = category?.parent?.slug ?? category?.slug;
  if (slug === "women") return "Women";
  if (slug === "men") return "Men";
  return null;
}

export function audienceShopPath(category: {
  name?: string;
  slug: string;
  parent?: { slug: string; name?: string } | null;
} | null): { name: string; path: string } | null {
  if (!category) return null;

  if (category.slug === "accessories" || category.parent?.slug === "accessories") {
    return { name: "Accessories", path: "/shop/accessories" };
  }

  const audienceSlug = category.parent?.slug ?? category.slug;
  const audienceName =
    category.parent?.name ??
    (audienceSlug === "women"
      ? "Women"
      : audienceSlug === "men"
        ? "Men"
        : category.name ?? category.slug);

  if (audienceSlug === "women" || audienceSlug === "men") {
    return { name: audienceName, path: `/shop/${audienceSlug}` };
  }

  return null;
}

/** Sort assignable categories: Women leaves, Men leaves, then Accessories. */
export function sortAssignableCategories<
  T extends {
    slug: string;
    name: string;
    parent?: { slug: string; name: string } | null;
  },
>(categories: T[]): T[] {
  const rank = (slug: string, parentSlug?: string | null) => {
    const audience = parentSlug ?? (slug === "accessories" ? "accessories" : slug);
    if (audience === "women") return 0;
    if (audience === "men") return 1;
    if (audience === "accessories" || slug === "accessories") return 2;
    return 3;
  };

  return [...categories].sort((a, b) => {
    const aRank = rank(a.slug, a.parent?.slug);
    const bRank = rank(b.slug, b.parent?.slug);
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
}

export type CategorySelectOption = {
  id: string;
  label: string;
  assignable: boolean;
};

/**
 * Options for product Category selects: assignable leaves (+ accessories),
 * plus the current category if it is a non-assignable root still on the product.
 */
export function productCategorySelectOptions(
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    parentCategoryId?: string | null;
    parent?: { id?: string; name: string; slug: string } | null;
  }>,
  currentCategoryId?: string | null
): CategorySelectOption[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const assignable = sortAssignableCategories(
    categories.filter((category) => isAssignableProductCategory(category))
  ).map((category) => ({
    id: category.id,
    label: categoryPathLabel(category),
    assignable: true,
  }));

  if (!currentCategoryId) return assignable;

  const current = byId.get(currentCategoryId);
  if (!current) return assignable;
  if (isAssignableProductCategory(current)) return assignable;
  if (assignable.some((option) => option.id === current.id)) return assignable;

  return [
    {
      id: current.id,
      label: `${current.name} (pick a Tops or Pants category)`,
      assignable: false,
    },
    ...assignable,
  ];
}
