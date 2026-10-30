import { Link } from "react-router";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import type { BundleCardData, BundleCardPiece } from "~/lib/packs";
import { cn, formatCurrency } from "~/lib/utils";

export type { BundleCardData, BundleCardPiece };

function PieceThumb({
  piece,
  cloudName,
  className,
}: {
  piece?: BundleCardPiece;
  cloudName?: string | null;
  className?: string;
}) {
  const src = piece?.publicId
    ? cloudinaryImageUrl(piece.publicId, cloudName, 720)
    : null;

  return (
    <div className={cn("relative min-h-0 overflow-hidden bg-[#f4f4f2]", className)}>
      {src ? (
        <img
          src={src}
          alt={piece?.alt ?? ""}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

export function BundleCard({
  bundle,
  cloudName,
}: {
  bundle: BundleCardData;
  cloudName?: string | null;
}) {
  const pieces = bundle.pieceImages.filter((piece) => piece.publicId).slice(0, 4);
  const hero = pieces[0];
  const stack = pieces.slice(1, 4);
  const price = Number(bundle.basePrice);
  const compareAt =
    bundle.compareAtPrice != null ? Number(bundle.compareAtPrice) : null;

  return (
    <article className="group">
      <Link
        to={bundle.href}
        prefetch="intent"
        className="block outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
      >
        <div className="border border-charcoal/12 bg-white p-1.5 sm:p-2">
          {stack.length === 0 ? (
            <div className="aspect-4/5">
              <PieceThumb piece={hero} cloudName={cloudName} className="h-full w-full" />
            </div>
          ) : (
            <div
              className={cn(
                "grid aspect-4/5 gap-1 sm:gap-1.5",
                stack.length === 1 && "grid-cols-2",
                stack.length === 2 && "grid-cols-[1.15fr_0.95fr] grid-rows-2",
                stack.length >= 3 && "grid-cols-[1.15fr_0.95fr] grid-rows-3"
              )}
            >
              <PieceThumb
                piece={hero}
                cloudName={cloudName}
                className={cn(
                  stack.length === 2 && "row-span-2",
                  stack.length >= 3 && "row-span-3"
                )}
              />
              {stack.map((piece) => (
                <PieceThumb
                  key={`${piece.publicId}-${piece.alt}`}
                  piece={piece}
                  cloudName={cloudName}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-3.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-[15px] font-medium tracking-tight text-charcoal transition-colors group-hover:text-navy">
            {bundle.name}
          </h3>
          <p className="text-[15px] text-charcoal/65">
            {formatCurrency(price)}
            {compareAt != null && compareAt > price && (
              <span className="ml-1.5 text-sm text-charcoal/35 line-through">
                {formatCurrency(compareAt)}
              </span>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function BundleGrid({
  bundles,
  cloudName,
}: {
  bundles: BundleCardData[];
  cloudName?: string | null;
}) {
  if (bundles.length === 0) {
    return <p className="py-16 text-center text-charcoal/50">No bundles yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-12">
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} cloudName={cloudName} />
      ))}
    </div>
  );
}
