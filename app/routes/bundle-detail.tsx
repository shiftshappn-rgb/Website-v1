import { useMemo, useState } from "react";
import type { Route } from "./+types/bundle-detail";
import { data, Link } from "react-router";
import { ProductGallery } from "~/components/storefront/ProductGallery";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { useCart } from "~/lib/cart";
import { allocatePrices, piecePrices, sortSizes } from "~/lib/sets";
import { buildMeta, breadcrumbJsonLd, JsonLd, productJsonLd } from "~/lib/seo";
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

type ExtraProduct = Piece;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.pack) return [{ title: "Bundle not found — shiftshappn" }];
  return buildMeta({
    title: `${loaderData.pack.name} — shiftshappn`,
    description: loaderData.pack.description ?? `${loaderData.pack.name} bundle`,
    path: `/bundles/${loaderData.pack.slug}`,
  });
}

function toPiece(
  product: {
    id: string;
    name: string;
    basePrice: { toString(): string } | number;
    variants: Array<{
      id: string;
      colorName: string;
      colorHex: string;
      size: string;
      inventoryQty: number;
      priceOverride: { toString(): string } | number | null;
      images: unknown;
    }>;
  }
): Piece {
  const basePrice = Number(product.basePrice);
  return {
    id: product.id,
    name: product.name,
    basePrice,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      size: variant.size,
      inventoryQty: variant.inventoryQty,
      price: variant.priceOverride != null ? Number(variant.priceOverride) : basePrice,
      images: parseVariantImages(variant.images).map((image) => ({
        publicId: image.publicId,
        altText: image.altText,
      })),
    })),
  };
}

function colorsOf(piece: Piece) {
  const seen = new Set<string>();
  const colors: Array<{ name: string; hex: string }> = [];
  for (const variant of piece.variants) {
    if (seen.has(variant.colorName)) continue;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }
  return colors;
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

export async function loader({ params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) throw data("Bundle not found", { status: 404 });
  const db = tryDb();
  if (!db) throw data("Bundle not found", { status: 404 });

  const pack = await db.pack.findUnique({
    where: { slug: params.slug, status: "active" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          bundle: {
            include: {
              products: {
                include: { product: { include: { variants: true } } },
              },
            },
          },
          product: { include: { variants: true } },
        },
      },
    },
  });

  const setItem = pack?.items.find((item) => item.bundle);
  const topLink = setItem?.bundle?.products.find((item) => item.role === "top");
  const pantsLink = setItem?.bundle?.products.find((item) => item.role === "pants");
  if (!pack || !setItem?.bundle || !topLink || !pantsLink) {
    throw data("Bundle not found", { status: 404 });
  }

  const top = toPiece(topLink.product);
  const pants = toPiece(pantsLink.product);
  const pantsColors = new Set(pants.variants.map((variant) => variant.colorName));
  const colors: Array<{ name: string; hex: string }> = [];
  const seen = new Set<string>();
  for (const variant of top.variants) {
    if (seen.has(variant.colorName) || !pantsColors.has(variant.colorName)) continue;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }

  const extras = pack.items
    .filter((item) => item.product && item.product.status === "active")
    .map((item) => toPiece(item.product!));

  return {
    pack: {
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      discountType: pack.discountType,
      discountValue: Number(pack.discountValue),
      set: {
        slug: setItem.bundle.slug,
        name: setItem.bundle.name,
        discountType: setItem.bundle.discountType,
        discountValue: Number(setItem.bundle.discountValue),
        colors,
        top,
        pants,
      },
      extras,
    },
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

function startingPick(extra: ExtraProduct) {
  const colors = colorsOf(extra);
  const color = colors.length === 1 ? colors[0].name : null;
  const sizes = sizesFor(extra, color);
  const size = color && sizes.length === 1 ? sizes[0].size : null;
  return { color, size };
}

export default function BundleDetail({ loaderData }: Route.ComponentProps) {
  const { pack, cloudName } = loaderData;
  const addPack = useCart((state) => state.addPack);
  const [color, setColor] = useState(pack.set.colors[0]?.name ?? null);
  const [topSize, setTopSize] = useState<string | null>(null);
  const [pantsSize, setPantsSize] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, { color: string | null; size: string | null }>>(
    () => Object.fromEntries(pack.extras.map((extra) => [extra.id, startingPick(extra)]))
  );
  const [quantity, setQuantity] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const topSizes = useMemo(() => sizesFor(pack.set.top, color), [pack.set.top, color]);
  const pantsSizes = useMemo(() => sizesFor(pack.set.pants, color), [pack.set.pants, color]);
  const topVariant = topSizes.find((variant) => variant.size === topSize) ?? null;
  const pantsVariant = pantsSizes.find((variant) => variant.size === pantsSize) ?? null;

  const extraVariants = pack.extras.map((extra) => {
    const pick = picks[extra.id] ?? { color: null, size: null };
    const variant = sizesFor(extra, pick.color).find((item) => item.size === pick.size) ?? null;
    return { extra, pick, variant };
  });

  const setPrices = piecePrices(
    topVariant?.price ?? pack.set.top.basePrice,
    pantsVariant?.price ?? pack.set.pants.basePrice,
    pack.set.discountType,
    pack.set.discountValue
  );
  const partPrices = [
    setPrices.top,
    setPrices.pants,
    ...extraVariants.map((item) => item.variant?.price ?? item.extra.basePrice),
  ];
  const priced = allocatePrices(partPrices, pack.discountType, pack.discountValue);
  const undiscounted =
    (topVariant?.price ?? pack.set.top.basePrice) +
    (pantsVariant?.price ?? pack.set.pants.basePrice) +
    extraVariants.reduce((sum, item) => sum + (item.variant?.price ?? item.extra.basePrice), 0);

  const setChosen = Boolean(topVariant && pantsVariant);
  const setReady = Boolean(
    topVariant && pantsVariant && topVariant.inventoryQty > 0 && pantsVariant.inventoryQty > 0
  );
  const extrasChosen = extraVariants.every((item) => item.variant);
  const extrasReady = extraVariants.every((item) => item.variant && item.variant.inventoryQty > 0);
  const canAdd = setReady && extrasReady;
  const inventories = [
    topVariant?.inventoryQty ?? 0,
    pantsVariant?.inventoryQty ?? 0,
    ...extraVariants.map((item) => item.variant?.inventoryQty ?? 0),
  ];
  const maxQty = canAdd ? Math.max(1, Math.min(...inventories)) : 1;

  const images = [
    ...(topVariant?.images.length ? topVariant.images : topSizes[0]?.images ?? []),
    ...extraVariants.flatMap((item) => item.variant?.images ?? item.extra.variants[0]?.images ?? []),
  ];
  const cloud = cloudName ?? "demo";
  const imageSrc = (publicId: string, width: number) =>
    `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
  const shown = images[Math.min(activeImage, Math.max(images.length - 1, 0))];

  function selectSetColor(next: string) {
    setColor(next);
    setTopSize(null);
    setPantsSize(null);
    setQuantity(1);
    setActiveImage(0);
  }

  function updateExtra(id: string, next: { color: string | null; size: string | null }) {
    setPicks((current) => ({ ...current, [id]: next }));
    setQuantity(1);
  }

  function handleAdd() {
    if (!canAdd || !topVariant || !pantsVariant || !color) return;
    const chosen = extraVariants.map((item) => item.variant!);
    const groupId = [pack.slug, topVariant.id, pantsVariant.id, ...chosen.map((variant) => variant.id)].join(":");
    const shares = allocatePrices(
      [setPrices.top, setPrices.pants, ...chosen.map((variant) => variant.price)],
      pack.discountType,
      pack.discountValue
    );
    const topImage = topVariant.images[0];
    addPack([
      {
        packGroupId: groupId,
        setGroupId: groupId,
        setRole: "top",
        variantId: topVariant.id,
        productId: pack.set.top.id,
        productName: `${pack.name} · Top`,
        variantLabel: `${color} / ${topVariant.size}`,
        colorHex: topVariant.colorHex,
        price: shares.shares[0] ?? setPrices.top,
        imagePublicId: topImage?.publicId,
        imageAlt: topImage?.altText || `${pack.set.name} top`,
        quantity,
      },
      {
        packGroupId: groupId,
        setGroupId: groupId,
        setRole: "pants",
        variantId: pantsVariant.id,
        productId: pack.set.pants.id,
        productName: `${pack.name} · Pants`,
        variantLabel: `${color} / ${pantsVariant.size}`,
        colorHex: pantsVariant.colorHex,
        price: shares.shares[1] ?? setPrices.pants,
        imagePublicId: pantsVariant.images[0]?.publicId ?? topImage?.publicId,
        imageAlt: pantsVariant.images[0]?.altText || `${pack.set.name} pants`,
        quantity,
      },
      ...chosen.map((variant, index) => ({
        packGroupId: groupId,
        variantId: variant.id,
        productId: extraVariants[index].extra.id,
        productName: `${pack.name} · ${extraVariants[index].extra.name}`,
        variantLabel: `${variant.colorName} / ${variant.size}`,
        colorHex: variant.colorHex,
        price: shares.shares[index + 2] ?? variant.price,
        imagePublicId: variant.images[0]?.publicId,
        imageAlt: variant.images[0]?.altText || extraVariants[index].extra.name,
        quantity,
      })),
    ]);
  }

  const addLabel = !topSize
    ? "Select a top size"
    : !pantsSize
      ? "Select a pants size"
      : !extrasChosen
        ? "Select each extra"
        : !setChosen || !setReady || !extrasReady
          ? "Out of stock"
          : `${formatCurrency(priced.total)} · Add to bag`;

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: pack.name,
          description: pack.description ?? pack.name,
          slug: pack.slug,
          path: `/bundles/${pack.slug}`,
          price: priced.total,
          inStock: canAdd || !setReady,
          image: shown ? imageSrc(shown.publicId, 1200) : undefined,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Bundles", path: "/shop/bundles" },
          { name: pack.name, path: `/bundles/${pack.slug}` },
        ])}
      />

      <div className="bg-white">
        <div className="mx-auto max-w-350 px-4 pb-36 pt-4 sm:px-6 lg:px-10 lg:pb-20 lg:pt-6">
          <nav className="mb-5 text-[13px] text-charcoal/45">
            <Link to="/shop/bundles" className="hover:text-charcoal">
              Bundles
            </Link>
            <span className="px-1.5">/</span>
            <span className="text-charcoal/70">{pack.name}</span>
          </nav>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,28rem)] lg:gap-16">
            <div className="lg:sticky lg:top-28">
              <ProductGallery
                images={images}
                activeIndex={activeImage}
                onChange={setActiveImage}
                alt={pack.name}
                imageSrc={imageSrc}
              />
            </div>

            <div>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-charcoal">
                {pack.name}
              </h1>
              <p className="mt-2 text-[13px] text-charcoal/55">
                {pack.set.name} set
                {pack.extras.length > 0 ? ` · ${pack.extras.map((extra) => extra.name).join(" · ")}` : ""}
              </p>
              <p className="mt-4 text-lg font-medium text-charcoal">
                {formatCurrency(priced.total)}
                {priced.total < undiscounted && (
                  <span className="ml-2 text-base font-normal text-charcoal/35 line-through">
                    {formatCurrency(undiscounted)}
                  </span>
                )}
              </p>

              <OptionRow
                label="Colour"
                selected={color}
                options={pack.set.colors.map((item) => ({
                  id: item.name,
                  label: item.name,
                  swatch: item.hex,
                  disabled: false,
                }))}
                onSelect={selectSetColor}
              />
              <OptionRow
                label="Top size"
                selected={topSize}
                options={topSizes.map((variant) => ({
                  id: variant.size,
                  label: variant.size,
                  disabled: variant.inventoryQty <= 0,
                }))}
                onSelect={(size) => {
                  setTopSize(size);
                  setQuantity(1);
                }}
                onChart={() => setChartOpen(true)}
              />
              <OptionRow
                label="Pants size"
                selected={pantsSize}
                options={pantsSizes.map((variant) => ({
                  id: variant.size,
                  label: variant.size,
                  disabled: variant.inventoryQty <= 0,
                }))}
                onSelect={(size) => {
                  setPantsSize(size);
                  setQuantity(1);
                }}
              />

              {extraVariants.map(({ extra, pick }) => {
                const colors = colorsOf(extra);
                const sizes = sizesFor(extra, pick.color);
                return (
                  <div key={extra.id} className="mt-10 border-t border-charcoal/10 pt-8">
                    <h2 className="text-[15px] font-medium text-charcoal">{extra.name}</h2>
                    {colors.length > 1 && (
                      <OptionRow
                        label="Colour"
                        selected={pick.color}
                        options={colors.map((item) => {
                          const itemSizes = sizesFor(extra, item.name);
                          return {
                            id: item.name,
                            label: item.name,
                            swatch: item.hex,
                            disabled: itemSizes.length > 0 && itemSizes.every((variant) => variant.inventoryQty <= 0),
                          };
                        })}
                        onSelect={(next) => {
                          const nextSizes = sizesFor(extra, next);
                          updateExtra(extra.id, {
                            color: next,
                            size: nextSizes.length === 1 ? nextSizes[0].size : null,
                          });
                        }}
                      />
                    )}
                    {pick.color && sizes.length > 1 && (
                      <OptionRow
                        label="Size"
                        selected={pick.size}
                        options={sizes.map((variant) => ({
                          id: variant.size,
                          label: variant.size,
                          disabled: variant.inventoryQty <= 0,
                        }))}
                        onSelect={(size) => updateExtra(extra.id, { color: pick.color, size })}
                      />
                    )}
                  </div>
                );
              })}

              <div className="mt-8 flex gap-2">
                <label className="sr-only" htmlFor="bundle-qty">
                  Quantity
                </label>
                <select
                  id="bundle-qty"
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

function OptionRow({
  label,
  selected,
  options,
  onSelect,
  onChart,
}: {
  label: string;
  selected: string | null;
  options: Array<{ id: string; label: string; disabled: boolean; swatch?: string }>;
  onSelect: (id: string) => void;
  onChart?: () => void;
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[13px] text-charcoal">
          {selected ? `${label}: ${selected}` : `Select a ${label.toLowerCase()}`}
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
      <div className="flex flex-wrap gap-2">
        {options.map((option) =>
          option.swatch ? (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={() => onSelect(option.id)}
              className={cn(
                "size-7 rounded-full border border-black/10",
                selected === option.id && "ring-1 ring-charcoal ring-offset-2",
                option.disabled && "cursor-not-allowed opacity-35"
              )}
              style={{ backgroundColor: option.swatch }}
              title={option.label}
              aria-label={option.label}
              aria-pressed={selected === option.id}
            />
          ) : (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={() => onSelect(option.id)}
              className={cn(
                "flex h-10 min-w-12 items-center justify-center rounded-md border px-3 text-[13px]",
                selected === option.id
                  ? "border-charcoal bg-charcoal text-white"
                  : "border-charcoal/20 bg-white text-charcoal hover:border-charcoal",
                option.disabled && "cursor-not-allowed line-through opacity-35"
              )}
            >
              {option.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
