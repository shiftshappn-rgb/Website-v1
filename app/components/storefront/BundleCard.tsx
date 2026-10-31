import { Link } from "react-router";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import type { BundleCardData, BundleCardPiece } from "~/lib/packs";
import { cn, formatCurrency } from "~/lib/utils";

export type { BundleCardData, BundleCardPiece };

function PieceThumb({
  piece,
  cloudName,
  className,
  priority = false,
}: {
  piece?: BundleCardPiece;
  cloudName?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const src = piece?.publicId
    ? cloudinaryImageUrl(piece.publicId, cloudName, priority ? 900 : 640)
    : null;

  return (
    <div className={cn("relative min-h-0 overflow-hidden bg-stone", className)}>
      {src ? (
        <img
          src={src}
          alt={piece?.alt ?? ""}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-sand to-stone" aria-hidden />
      )}
    </div>
  );
}

function Collage({
  pieces,
  cloudName,
}: {
  pieces: BundleCardPiece[];
  cloudName?: string | null;
}) {
  const hero = pieces[0];
  const stack = pieces.slice(1, 4);

  if (stack.length === 0) {
    return (
      <div className="absolute inset-0">
        <PieceThumb piece={hero} cloudName={cloudName} className="h-full w-full" priority />
      </div>
    );
  }

  if (stack.length === 1) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-px bg-charcoal/10">
        <PieceThumb piece={hero} cloudName={cloudName} className="h-full" priority />
        <PieceThumb piece={stack[0]} cloudName={cloudName} className="h-full" />
      </div>
    );
  }

  if (stack.length === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-[1.2fr_0.9fr] grid-rows-2 gap-px bg-charcoal/10">
        <PieceThumb
          piece={hero}
          cloudName={cloudName}
          className="row-span-2 h-full"
          priority
        />
        <PieceThumb piece={stack[0]} cloudName={cloudName} className="h-full" />
        <PieceThumb piece={stack[1]} cloudName={cloudName} className="h-full" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 grid grid-cols-[1.2fr_0.9fr] grid-rows-3 gap-px bg-charcoal/10">
      <PieceThumb
        piece={hero}
        cloudName={cloudName}
        className="row-span-3 h-full"
        priority
      />
      {stack.map((piece) => (
        <PieceThumb
          key={`${piece.publicId}-${piece.alt}`}
          piece={piece}
          cloudName={cloudName}
          className="h-full"
        />
      ))}
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
  const price = Number(bundle.basePrice);
  const compareAt =
    bundle.compareAtPrice != null ? Number(bundle.compareAtPrice) : null;
  const hasSavings = compareAt != null && compareAt > price;
  const savings = hasSavings ? Math.round(compareAt - price) : 0;
  const includes = pieces
    .map((piece) => piece.alt?.trim())
    .filter(Boolean)
    .slice(0, 4);
  const pieceCount = Math.max(pieces.length, includes.length);

  return (
    <article className="group">
      <Link
        to={bundle.href}
        prefetch="intent"
        className="block outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-4"
      >
        <div className="relative aspect-4/5 overflow-hidden bg-stone">
          <Collage pieces={pieces} cloudName={cloudName} />

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-charcoal/35 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden
          />

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-charcoal/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold backdrop-blur-sm">
              Bundle
            </span>
            {pieceCount > 0 && (
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal backdrop-blur-sm">
                {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
              </span>
            )}
          </div>

          {hasSavings && savings > 0 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              Save {formatCurrency(savings)}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <h3 className="text-[15px] font-medium tracking-tight text-charcoal transition-colors duration-200 group-hover:text-navy">
            {bundle.name}
          </h3>

          {includes.length > 0 && (
            <p className="line-clamp-1 text-[12px] leading-snug text-charcoal/50">
              {includes.join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5">
            <span className="text-[15px] font-semibold tabular-nums text-navy">
              {formatCurrency(price)}
            </span>
            {hasSavings && (
              <span className="text-sm tabular-nums text-charcoal/35 line-through">
                {formatCurrency(compareAt)}
              </span>
            )}
          </div>
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
    return (
      <p className="py-16 text-center text-sm text-charcoal/50">
        No bundles yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} cloudName={cloudName} />
      ))}
    </div>
  );
}
