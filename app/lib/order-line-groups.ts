/** Bundle/set cart lines are named `"<Offer> · <Product>"`. */

export function parseBundleProductName(productName: string): {
  bundleName: string | null;
  pieceName: string;
} {
  const separator = " · ";
  const index = productName.indexOf(separator);
  if (index <= 0) {
    return { bundleName: null, pieceName: productName };
  }
  return {
    bundleName: productName.slice(0, index),
    pieceName: productName.slice(index + separator.length),
  };
}

export type OrderLineLike = {
  productName: string;
  variantLabel: string;
  quantity: number;
  priceAtPurchase: number;
};

export type OrderLineGroup =
  | {
      kind: "bundle";
      name: string;
      lines: Array<OrderLineLike & { pieceName: string }>;
      total: number;
    }
  | {
      kind: "single";
      line: OrderLineLike;
      total: number;
    };

/** Group consecutive lines that share the same `"Bundle · …"` prefix. */
export function groupOrderLines(items: OrderLineLike[]): OrderLineGroup[] {
  const groups: OrderLineGroup[] = [];

  for (const item of items) {
    const { bundleName, pieceName } = parseBundleProductName(item.productName);
    const lineTotal = item.priceAtPurchase * item.quantity;

    if (!bundleName) {
      groups.push({ kind: "single", line: item, total: lineTotal });
      continue;
    }

    const last = groups[groups.length - 1];
    if (last?.kind === "bundle" && last.name === bundleName) {
      last.lines.push({ ...item, pieceName });
      last.total += lineTotal;
      continue;
    }

    groups.push({
      kind: "bundle",
      name: bundleName,
      lines: [{ ...item, pieceName }],
      total: lineTotal,
    });
  }

  return groups;
}
