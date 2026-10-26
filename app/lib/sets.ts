import { CATALOG_SIZES } from "~/lib/product-catalog";

export function piecePrices(
  topPrice: number,
  pantsPrice: number,
  discountType: "percent" | "fixed",
  discountValue: number
) {
  const sum = topPrice + pantsPrice;
  const total =
    discountType === "percent"
      ? Math.round(sum * (1 - discountValue / 100) * 100) / 100
      : Math.max(0, Math.round((sum - discountValue) * 100) / 100);

  if (sum <= 0) return { top: 0, pants: 0, total: 0 };
  const top = Math.round(total * (topPrice / sum) * 100) / 100;
  const pants = Math.round((total - top) * 100) / 100;
  return { top, pants, total };
}

export function allocatePrices(
  parts: number[],
  discountType: "percent" | "fixed",
  discountValue: number
) {
  const sum = parts.reduce((total, price) => total + price, 0);
  const total =
    discountType === "percent"
      ? Math.round(sum * (1 - discountValue / 100) * 100) / 100
      : Math.max(0, Math.round((sum - discountValue) * 100) / 100);

  if (parts.length === 0) return { shares: [] as number[], total: 0 };
  if (sum <= 0) return { shares: parts.map(() => 0), total: 0 };

  const shares: number[] = [];
  let assigned = 0;
  parts.forEach((price, index) => {
    if (index === parts.length - 1) {
      shares.push(Math.round((total - assigned) * 100) / 100);
      return;
    }
    const share = Math.round(total * (price / sum) * 100) / 100;
    shares.push(share);
    assigned += share;
  });
  return { shares, total };
}

export function sortSizes<T extends { size: string }>(variants: T[]) {
  return [...variants].sort((a, b) => {
    const ai = CATALOG_SIZES.indexOf(a.size as (typeof CATALOG_SIZES)[number]);
    const bi = CATALOG_SIZES.indexOf(b.size as (typeof CATALOG_SIZES)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
