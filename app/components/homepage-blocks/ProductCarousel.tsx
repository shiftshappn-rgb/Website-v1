import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCardTile } from "./ProductCardTile";
import type { ProductSummary } from "./types";

export function ProductCarousel({
  products,
  cloudName,
}: {
  products: ProductSummary[];
  cloudName?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateScrollState() {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 8);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 8);
  }

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [products.length]);

  function scrollByPage(direction: "left" | "right") {
    const track = trackRef.current;
    if (!track) return;
    const amount = Math.max(track.clientWidth * 0.85, 280);
    track.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateScrollState}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-8"
      >
        {products.map((product, index) => (
          <ProductCardTile
            key={product.id}
            product={product}
            cloudName={cloudName}
            className="w-[72vw] max-w-[17rem] shrink-0 snap-start sm:w-[16rem] lg:w-[18rem]"
            style={{ "--stagger-delay": `${index * 50}ms` } as CSSProperties}
          />
        ))}
      </div>

      {products.length > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollByPage("left")}
            disabled={!canScrollLeft}
            aria-label="Previous products"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal transition-colors hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage("right")}
            disabled={!canScrollRight}
            aria-label="Next products"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal transition-colors hover:border-navy hover:text-navy disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
