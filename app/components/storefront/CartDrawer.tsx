import { useEffect, useMemo, useState } from "react";
import { Gift, X, Minus, Plus } from "lucide-react";
import { Link } from "react-router";
import { useCart, type CartItem } from "~/lib/cart";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { parseBundleProductName } from "~/lib/order-line-groups";
import { cn, formatCurrency } from "~/lib/utils";

function CartThumb({
  publicId,
  alt,
  cloudName,
  className,
}: {
  publicId: string;
  alt: string;
  cloudName?: string | null;
  className?: string;
}) {
  const src = cloudinaryImageUrl(publicId, cloudName, 200);
  if (!src) {
    return <div className={cn("bg-stone", className)} aria-hidden />;
  }
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

type CartRow =
  | { kind: "single"; item: CartItem }
  | {
      kind: "group";
      groupKey: string;
      packGroupId?: string;
      setGroupId?: string;
      title: string;
      includes: string[];
      quantity: number;
      unitTotal: number;
      lead: CartItem;
      lines: CartItem[];
    };

function buildCartRows(items: CartItem[]): CartRow[] {
  const rows: CartRow[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const groupKey = item.packGroupId
      ? `pack:${item.packGroupId}`
      : item.setGroupId
        ? `set:${item.setGroupId}`
        : null;

    if (!groupKey) {
      rows.push({ kind: "single", item });
      continue;
    }
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);

    const lines = items.filter((candidate) =>
      item.packGroupId
        ? candidate.packGroupId === item.packGroupId
        : candidate.setGroupId === item.setGroupId && !candidate.packGroupId
    );

    const title =
      parseBundleProductName(lines[0]?.productName ?? "").bundleName ??
      lines[0]?.productName ??
      "Bundle";
    const includes = lines.map(
      (line) => parseBundleProductName(line.productName).pieceName
    );
    const unitTotal = lines.reduce((sum, line) => sum + line.price, 0);

    rows.push({
      kind: "group",
      groupKey,
      packGroupId: item.packGroupId,
      setGroupId: item.packGroupId ? undefined : item.setGroupId,
      title,
      includes,
      quantity: lines[0]?.quantity ?? 1,
      unitTotal,
      lead: lines[0]!,
      lines,
    });
  }

  return rows;
}

export function CartDrawer({ cloudName = null }: { cloudName?: string | null }) {
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);

  const cartState = useCart();
  const items = isHydrated ? cartState.items : [];
  const isOpen = isHydrated ? cartState.isOpen : false;

  const {
    closeCart,
    removeItem,
    updateQuantity,
    subtotal,
    isGiftCardsOnly,
  } = cartState;

  const rows = useMemo(() => buildCartRows(items), [items]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60]",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
    >
      <div
        className={cn(
          "absolute inset-0 bg-charcoal/50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={closeCart}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-charcoal/10 p-6">
          <h2 className="font-serif text-lg text-navy">Your cart</h2>
          <button
            onClick={closeCart}
            className="flex min-h-11 min-w-11 items-center justify-center p-2.5 text-charcoal/60 hover:text-charcoal"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {items.length === 0 ? (
            <p className="py-12 text-center text-charcoal/60">Your cart is empty</p>
          ) : (
            rows.map((row) => {
              if (row.kind === "group") {
                const { lead } = row;
                return (
                  <div key={row.groupKey} className="flex gap-4">
                    <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-stone">
                      {lead.imagePublicId ? (
                        <CartThumb
                          publicId={lead.imagePublicId}
                          alt={lead.imageAlt ?? row.title}
                          cloudName={cloudName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-stone" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-charcoal">
                        {row.title}
                      </p>
                      <p className="mt-0.5 text-xs text-charcoal/60">
                        Includes: {row.includes.join(", ")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-navy">
                        {formatCurrency(row.unitTotal)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 gap-y-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              lead.variantId,
                              row.quantity - 1,
                              row.setGroupId,
                              row.packGroupId
                            )
                          }
                          className="flex min-h-10 min-w-10 items-center justify-center rounded border border-charcoal/20 p-2"
                          aria-label="Decrease bundle quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm">{row.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              lead.variantId,
                              row.quantity + 1,
                              row.setGroupId,
                              row.packGroupId
                            )
                          }
                          className="flex min-h-10 min-w-10 items-center justify-center rounded border border-charcoal/20 p-2"
                          aria-label="Increase bundle quantity"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(lead.variantId, row.setGroupId, row.packGroupId)
                          }
                          className="ml-auto inline-flex min-h-10 items-center px-2 text-xs text-charcoal/50 hover:text-terracotta"
                        >
                          Remove bundle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              const item = row.item;
              const isGift = (item.kind ?? "product") === "gift_card";
              return (
                <div key={`item-${item.variantId}`} className="flex gap-4">
                  <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-stone">
                    {isGift ? (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-sky/20 text-sky">
                        <Gift className="h-6 w-6" />
                        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider">
                          E-gift
                        </span>
                      </div>
                    ) : item.imagePublicId ? (
                      <CartThumb
                        publicId={item.imagePublicId}
                        alt={item.imageAlt ?? item.productName}
                        cloudName={cloudName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-stone" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-charcoal">
                      {item.productName}
                    </p>
                    <p className="text-xs text-charcoal/60">{item.variantLabel}</p>
                    <p className="mt-1 text-sm font-medium text-navy">
                      {formatCurrency(item.price)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 gap-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.variantId,
                            item.quantity - 1,
                            item.setGroupId,
                            item.packGroupId
                          )
                        }
                        className="flex min-h-10 min-w-10 items-center justify-center rounded border border-charcoal/20 p-2"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.variantId,
                            item.quantity + 1,
                            item.setGroupId,
                            item.packGroupId
                          )
                        }
                        className="flex min-h-10 min-w-10 items-center justify-center rounded border border-charcoal/20 p-2"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          removeItem(item.variantId, item.setGroupId, item.packGroupId)
                        }
                        className="ml-auto inline-flex min-h-10 items-center px-2 text-xs text-charcoal/50 hover:text-terracotta"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-4 border-t border-charcoal/10 p-6">
            <div className="flex justify-between text-sm">
              <span className="text-charcoal/70">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal())}</span>
            </div>
            <p className="text-xs text-charcoal/50">
              {isGiftCardsOnly()
                ? "Digital delivery — codes emailed after checkout"
                : "Shipping and taxes calculated at checkout"}
            </p>
            <div className="space-y-3">
              <Link
                to="/checkout"
                className="inline-flex w-full items-center justify-center rounded-lg bg-terracotta px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-terracotta/90"
                onClick={closeCart}
              >
                Proceed to checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
