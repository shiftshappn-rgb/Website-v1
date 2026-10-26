import { useMemo, useState } from "react";
import type { Route } from "./+types/set-detail";
import { data, Link, useSearchParams } from "react-router";
import { ProductGallery } from "~/components/storefront/ProductGallery";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { useCart } from "~/lib/cart";
import { piecePrices, sortSizes } from "~/lib/sets";
import { buildMeta, breadcrumbJsonLd, JsonLd, productJsonLd } from "~/lib/seo";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { cn, formatCurrency, parseVariantImages } from "~/lib/utils";

type PieceVariant = {
  id: string;
  colorName: string;
  colorHex: string;
  size: string;
  inventoryQty: number;
  price: number;
  images: Array<{ publicId: string; altText: string }>;
};

type Piece = {
  id: string;
  name: string;
  basePrice: number;
  variants: PieceVariant[];
};

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.set) return [{ title: "Set not found — shiftshappn" }];
  return buildMeta({
    title: `${loaderData.set.name} set — shiftshappn`,
    description: loaderData.set.description ?? `${loaderData.set.name} scrub set`,
    path: `/sets/${loaderData.set.slug}`,
  });
}

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) throw data("Set not found", { status: 404 });
  const db = tryDb();
  if (!db) throw data("Set not found", { status: 404 });

  const bundle = await db.bundle.findUnique({
    where: { slug: params.slug },
    include: {
      products: {
        include: {
          product: {
            include: {
              variants: true,
              category: { include: { parent: true } },
            },
          },
        },
      },
    },
  });

  const topLink = bundle?.products.find((item) => item.role === "top");
  const pantsLink = bundle?.products.find((item) => item.role === "pants");
  if (!bundle || !topLink || !pantsLink) throw data("Set not found", { status: 404 });

  const toPiece = (link: typeof topLink): Piece => ({
    id: link.product.id,
    name: link.product.name,
    basePrice: Number(link.product.basePrice),
    variants: link.product.variants.map((variant) => ({
      id: variant.id,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      size: variant.size,
      inventoryQty: variant.inventoryQty,
      price: variant.priceOverride != null ? Number(variant.priceOverride) : Number(link.product.basePrice),
      images: parseVariantImages(variant.images).map((image) => ({
        publicId: image.publicId,
        altText: image.altText,
      })),
    })),
  });

  const top = toPiece(topLink);
  const pants = toPiece(pantsLink);
  const pantsColors = new Set(pants.variants.map((variant) => variant.colorName));
  const colors: Array<{ name: string; hex: string }> = [];
  const seen = new Set<string>();
  function addColor(variant: { colorName: string; colorHex: string }) {
    if (seen.has(variant.colorName)) return;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }
  function colorHasImages(colorName: string) {
    return [...top.variants, ...pants.variants].some(
      (variant) => variant.colorName === colorName && variant.images.length > 0
    );
  }
  for (const variant of top.variants) {
    if (pantsColors.has(variant.colorName)) addColor(variant);
  }
  for (const variant of [...top.variants, ...pants.variants]) {
    if (colorHasImages(variant.colorName)) addColor(variant);
  }

  const category = topLink.product.category;
  const audience = category?.parent?.slug ?? category?.slug ?? null;
  const requested = new URL(request.url).searchParams.get("color");

  return {
    set: {
      id: bundle.id,
      slug: bundle.slug,
      name: bundle.name,
      description: bundle.description,
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue),
      audience,
      audienceName: category?.parent?.name ?? category?.name ?? "Shop",
      colors,
      top,
      pants,
    },
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    initialColor:
      (requested && colors.some((color) => color.name === requested) ? requested : null) ??
      colors.find((color) => colorHasImages(color.name))?.name ??
      colors[0]?.name ??
      null,
  };
}

function sizesFor(piece: Piece, color: string | null) {
  const matches = piece.variants.filter((variant) => variant.colorName === color);
  const bySize = new Map<string, PieceVariant>();
  for (const variant of matches) {
    const current = bySize.get(variant.size);
    if (!current || variant.inventoryQty > current.inventoryQty) bySize.set(variant.size, variant);
  }
  return sortSizes([...bySize.values()]);
}

export default function SetDetail({ loaderData }: Route.ComponentProps) {
  const { set, cloudName, initialColor } = loaderData;
  const addSet = useCart((state) => state.addSet);
  const [searchParams, setSearchParams] = useSearchParams();
  const [topSize, setTopSize] = useState<string | null>(null);
  const [pantsSize, setPantsSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const selectedColor =
    searchParams.get("color") && set.colors.some((color) => color.name === searchParams.get("color"))
      ? searchParams.get("color")
      : initialColor;

  const topSizes = useMemo(() => sizesFor(set.top, selectedColor), [set.top, selectedColor]);
  const pantsSizes = useMemo(() => sizesFor(set.pants, selectedColor), [set.pants, selectedColor]);
  const topVariant = topSizes.find((variant) => variant.size === topSize) ?? null;
  const pantsVariant = pantsSizes.find((variant) => variant.size === pantsSize) ?? null;

  const prices = piecePrices(
    topVariant?.price ?? set.top.basePrice,
    pantsVariant?.price ?? set.pants.basePrice,
    set.discountType,
    set.discountValue
  );
  const compareAt = set.top.basePrice + set.pants.basePrice;
  const bothChosen = Boolean(topVariant && pantsVariant);
  const inStock = Boolean(
    topVariant && pantsVariant && topVariant.inventoryQty > 0 && pantsVariant.inventoryQty > 0
  );
  const maxQty = bothChosen ? Math.max(1, Math.min(topVariant!.inventoryQty, pantsVariant!.inventoryQty)) : 1;
  const canAdd = bothChosen && inStock;

  const images = useMemo(() => {
    const seen = new Set<string>();
    const collected: Array<{ publicId: string; altText: string }> = [];
    const lists = [
      topVariant?.images.length ? topVariant.images : topSizes[0]?.images ?? [],
      pantsVariant?.images.length ? pantsVariant.images : pantsSizes[0]?.images ?? [],
    ];
    for (const list of lists) {
      for (const image of list) {
        if (seen.has(image.publicId)) continue;
        seen.add(image.publicId);
        collected.push(image);
      }
    }
    return collected;
  }, [pantsSizes, pantsVariant, topSizes, topVariant]);
  const imageSrc = (publicId: string, width: number) =>
    cloudinaryImageUrl(publicId, cloudName, width) ?? publicId;

  function selectColor(colorName: string) {
    setTopSize(null);
    setPantsSize(null);
    setQuantity(1);
    setActiveImage(0);
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set("color", colorName);
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  function handleAdd() {
    if (!topVariant || !pantsVariant || !selectedColor) return;
    const groupId = `${set.slug}:${topVariant.id}:${pantsVariant.id}`;
    const topImage = topVariant.images[0];
    const pantsImage = pantsVariant.images[0] ?? topImage;
    const shares = piecePrices(
      topVariant.price,
      pantsVariant.price,
      set.discountType,
      set.discountValue
    );
    addSet([
      {
        setGroupId: groupId,
        setRole: "top",
        variantId: topVariant.id,
        productId: set.top.id,
        productName: `${set.name} set · Top`,
        variantLabel: `${selectedColor} / ${topVariant.size}`,
        colorHex: topVariant.colorHex,
        price: shares.top,
        imagePublicId: topImage?.publicId,
        imageAlt: topImage?.altText || `${set.name} top`,
        quantity,
      },
      {
        setGroupId: groupId,
        setRole: "pants",
        variantId: pantsVariant.id,
        productId: set.pants.id,
        productName: `${set.name} set · Pants`,
        variantLabel: `${selectedColor} / ${pantsVariant.size}`,
        colorHex: pantsVariant.colorHex,
        price: shares.pants,
        imagePublicId: pantsImage?.publicId,
        imageAlt: pantsImage?.altText || `${set.name} pants`,
        quantity,
      },
    ]);
  }

  const addLabel =
    topSizes.length === 0
      ? "Top is not offered in this colour"
      : pantsSizes.length === 0
        ? "Pants are not offered in this colour"
        : !topSize
          ? "Select a top size"
          : !pantsSize
            ? "Select a pants size"
            : !inStock
              ? "Out of stock"
              : `${formatCurrency(prices.total)} · Add to bag`;

  const detailLines = (set.description ?? "")
    .split("•")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: `${set.name} set`,
          description: set.description ?? `${set.name} scrub set`,
          slug: set.slug,
          path: `/sets/${set.slug}`,
          price: prices.total,
          inStock: canAdd || !bothChosen,
          image: images[0] ? imageSrc(images[0].publicId, 1200) : undefined,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          ...(set.audience
            ? [{ name: set.audienceName, path: `/shop/${set.audience}` }]
            : []),
          { name: `${set.name} set`, path: `/sets/${set.slug}` },
        ])}
      />

      <div className="bg-white">
        <div className="mx-auto max-w-350 px-4 pb-36 pt-4 sm:px-6 lg:px-10 lg:pb-20 lg:pt-6">
          <nav className="mb-5 text-[13px] text-charcoal/45">
            <Link to="/shop" className="hover:text-charcoal">
              Shop
            </Link>
            {set.audience && (
              <>
                <span className="px-1.5">/</span>
                <Link to={`/shop/${set.audience}`} className="hover:text-charcoal">
                  {set.audienceName}
                </Link>
              </>
            )}
            <span className="px-1.5">/</span>
            <span className="text-charcoal/70">{set.name} set</span>
          </nav>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,28rem)] lg:gap-16">
            <div className="lg:sticky lg:top-28">
              <ProductGallery
                images={images}
                activeIndex={activeImage}
                onChange={setActiveImage}
                alt={`${set.name} set`}
                imageSrc={imageSrc}
              />
            </div>

            <div>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-charcoal">
                {set.name} set
              </h1>
              <p className="mt-4 text-lg font-medium text-charcoal">
                {formatCurrency(prices.total)}
                {prices.total < compareAt && (
                  <span className="ml-2 text-base font-normal text-charcoal/35 line-through">
                    {formatCurrency(compareAt)}
                  </span>
                )}
              </p>

              <div className="mt-8">
                <p className="mb-3 text-[13px] text-charcoal">
                  Colour: <span className="font-medium">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {set.colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => selectColor(color.name)}
                      className={cn(
                        "size-7 rounded-full border border-black/10",
                        selectedColor === color.name && "ring-1 ring-charcoal ring-offset-2"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                      aria-label={color.name}
                      aria-pressed={selectedColor === color.name}
                    />
                  ))}
                </div>
              </div>

              <SizeRow
                label="Top size"
                selected={topSize}
                sizes={topSizes}
                onSelect={(size) => {
                  setTopSize(size);
                  setQuantity(1);
                }}
                onChart={() => setChartOpen(true)}
              />
              <SizeRow
                label="Pants size"
                selected={pantsSize}
                sizes={pantsSizes}
                onSelect={(size) => {
                  setPantsSize(size);
                  setQuantity(1);
                }}
              />

              <div className="mt-8 flex gap-2">
                <label className="sr-only" htmlFor="set-qty">
                  Quantity
                </label>
                <select
                  id="set-qty"
                  value={Math.min(quantity, maxQty)}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  disabled={!canAdd}
                  className="h-14 w-16 appearance-none border border-charcoal/20 bg-white text-center text-sm disabled:opacity-40"
                >
                  {Array.from({ length: Math.min(9, maxQty) }).map((_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className={cn(
                    "h-14 flex-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-white",
                    canAdd ? "bg-charcoal hover:bg-charcoal/90" : "bg-[#6f2f3a]"
                  )}
                >
                  {addLabel}
                </button>
              </div>
              <p className="mt-3 text-center text-[12px] text-charcoal/45">
                HST applied at checkout.{" "}
                <Link to="/policies/returns" className="underline underline-offset-4 hover:text-navy">
                  Free size exchange within 30 days.
                </Link>
              </p>

              {detailLines.length > 0 && (
                <ul className="mt-10 space-y-2 border-t border-charcoal/10 pt-8 text-[14px] text-charcoal/75">
                  {detailLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-white p-3 lg:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className={cn(
            "h-12 w-full text-[12px] font-semibold uppercase tracking-[0.14em] text-white",
            canAdd ? "bg-charcoal" : "bg-[#6f2f3a]"
          )}
        >
          {addLabel}
        </button>
      </div>
      <SizeChartDrawer open={chartOpen} onClose={() => setChartOpen(false)} />
    </>
  );
}

function SizeRow({
  label,
  selected,
  sizes,
  onSelect,
  onChart,
}: {
  label: string;
  selected: string | null;
  sizes: PieceVariant[];
  onSelect: (size: string) => void;
  onChart?: () => void;
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[13px] text-charcoal">
          {sizes.length === 0
            ? `${label} is not offered in this colour`
            : selected
              ? `${label}: ${selected}`
              : `Select a ${label.toLowerCase()}`}
        </p>
        {onChart && (
          <button
            type="button"
            onClick={onChart}
            className="text-[13px] text-charcoal underline underline-offset-4"
          >
            Size chart
          </button>
        )}
      </div>
      {sizes.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {sizes.map((variant) => (
          <button
            key={variant.id}
            type="button"
            disabled={variant.inventoryQty <= 0}
            onClick={() => onSelect(variant.size)}
            className={cn(
              "flex h-10 min-w-12 items-center justify-center rounded-md border px-3 text-[13px]",
              selected === variant.size
                ? "border-charcoal bg-charcoal text-white"
                : "border-charcoal/20 bg-white text-charcoal hover:border-charcoal",
              variant.inventoryQty <= 0 && "cursor-not-allowed line-through opacity-35"
            )}
          >
            {variant.size}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
