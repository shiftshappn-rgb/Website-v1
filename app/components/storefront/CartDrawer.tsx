import { X, Minus, Plus } from "lucide-react";
import { Form } from "react-router";
import { useCart } from "~/lib/cart";
import { cn, formatCurrency } from "~/lib/utils";
import { Button } from "~/components/ui/Button";

function CloudinaryImage({
  publicId,
  alt,
  className,
}: {
  publicId: string;
  alt: string;
  className?: string;
}) {
  const src = publicId.startsWith("http")
    ? publicId
    : `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_200/${publicId}`;

  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, subtotal } =
    useCart();

  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
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
          "absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-charcoal/10">
          <h2 className="text-lg font-serif text-navy">Your cart</h2>
          <button
            onClick={closeCart}
            className="p-2 text-charcoal/60 hover:text-charcoal"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <p className="text-charcoal/60 text-center py-12">
              Your cart is empty
            </p>
          ) : (
            items.map((item) => (
              <div key={item.variantId} className="flex gap-4">
                <div className="w-20 h-24 bg-stone rounded-lg overflow-hidden flex-shrink-0">
                  {item.imagePublicId ? (
                    <CloudinaryImage
                      publicId={item.imagePublicId}
                      alt={item.imageAlt ?? item.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-stone" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">
                    {item.productName}
                  </p>
                  <p className="text-xs text-charcoal/60">{item.variantLabel}</p>
                  <p className="text-sm font-medium text-navy mt-1">
                    {formatCurrency(item.price)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity - 1)
                      }
                      className="p-1 border border-charcoal/20 rounded"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateQuantity(item.variantId, item.quantity + 1)
                      }
                      className="p-1 border border-charcoal/20 rounded"
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="ml-auto text-xs text-charcoal/50 hover:text-terracotta"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-charcoal/10 p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-charcoal/70">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal())}</span>
            </div>
            <p className="text-xs text-charcoal/50">
              Shipping and taxes calculated at checkout
            </p>
            <Form method="post" action="/api/checkout">
              <input
                type="hidden"
                name="cart"
                value={JSON.stringify(items)}
              />
              <Button type="submit" variant="terracotta" className="w-full">
                Proceed to checkout
              </Button>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
