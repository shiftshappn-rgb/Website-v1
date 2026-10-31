import { groupOrderLines, type OrderLineLike } from "~/lib/order-line-groups";
import { formatCurrency } from "~/lib/utils";

export function OrderLineGroups({
  items,
  className,
}: {
  items: OrderLineLike[];
  className?: string;
}) {
  const groups = groupOrderLines(items);

  return (
    <ul className={className}>
      {groups.map((group, index) => {
        if (group.kind === "bundle") {
          return (
            <li key={`bundle-${group.name}-${index}`} className="space-y-2">
              <div className="flex justify-between gap-3 text-sm font-medium text-charcoal">
                <span>Bundle: {group.name}</span>
                <span className="shrink-0 tabular-nums">{formatCurrency(group.total)}</span>
              </div>
              <ul className="space-y-1 border-l border-charcoal/10 pl-3">
                {group.lines.map((line, lineIndex) => (
                  <li
                    key={`${line.pieceName}-${line.variantLabel}-${lineIndex}`}
                    className="flex justify-between gap-3 text-xs text-charcoal/65"
                  >
                    <span>
                      {line.pieceName}
                      {line.variantLabel ? ` — ${line.variantLabel}` : ""} × {line.quantity}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrency(line.priceAtPurchase * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        }

        const { line } = group;
        return (
          <li
            key={`single-${line.productName}-${line.variantLabel}-${index}`}
            className="flex justify-between gap-3 text-sm"
          >
            <span className="text-charcoal/80">
              {line.productName}
              {line.variantLabel ? ` — ${line.variantLabel}` : ""} × {line.quantity}
            </span>
            <span className="shrink-0 tabular-nums text-charcoal/60">
              {formatCurrency(group.total)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
