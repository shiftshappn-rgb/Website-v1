import { useMemo, useState } from "react";
import type { Route } from "./+types/bundle-detail";
import { data, Link } from "react-router";
import { ProductGallery } from "~/components/storefront/ProductGallery";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { useCart } from "~/lib/cart";
import { resolveStorefrontPackProducts } from "~/lib/packs.server";
import { allocatePrices, sortSizes } from "~/lib/sets";
import { buildMeta, breadcrumbJsonLd, JsonLd, productJsonLd } from "~/lib/seo";
import { cn, ctaFromHex, formatCurrency, getVariantLabel, parseVariantImages } from "~/lib/utils";

type PieceVariant = {
  id: string;
  colorName: string;
  colorHex: string;
  size: string;
  inventoryQty: number;
  price: number;
  images: Array<{ publicId: string; altText: string }>;
};

type BundleProduct = {
  id: string;
  name: string;
  basePrice: number;
  isPrimary: boolean;
  variants: PieceVariant[];
};

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.pack) return [{ title: "Bundle not found — shiftshappn" }];
  return buildMeta({
    title: `${loaderData.pack.name} — shiftshappn`,
    description: loaderData.pack.description ?? `${loaderData.pack.name} bundle`,
    path: `/bundles/${loaderData.pack.slug}`,
  });
}

function toBundleProduct(
  product: {
    id: string;
    name: string;
    basePrice: number;
    isPrimary: boolean;
    variants: Array<{
      id?: string;
      colorName: string;
      colorHex: string;
      size?: string;
      inventoryQty?: number;
      priceOverride?: { toString(): string } | number | null;
      images: unknown;
    }>;
  },
  fullVariants?: Array<{
    id: string;
    colorName: string;
    colorHex: string;
    size: string;
    inventoryQty: number;
    priceOverride: { toString(): string } | number | null;
    images: unknown;
  }>
): BundleProduct {
  const variants = (fullVariants ?? product.variants).map((variant) => ({
    id: String(variant.id ?? ""),
    colorName: variant.colorName,
    colorHex: variant.colorHex,
    size: String(variant.size ?? ""),
    inventoryQty: Number(variant.inventoryQty ?? 0),
    price:
      variant.priceOverride != null
        ? Number(variant.priceOverride)
        : product.basePrice,
    images: parseVariantImages(variant.images).map((image) => ({
      publicId: image.publicId,
      altText: image.altText,
    })),
  }));

  return {
    id: product.id,
    name: product.name,
    basePrice: product.basePrice,
    isPrimary: product.isPrimary,
    variants,
  };
}

function colorsOf(piece: BundleProduct) {
  const seen = new Set<string>();
  const colors: Array<{ name: string; hex: string }> = [];
  for (const variant of piece.variants) {
    if (seen.has(variant.colorName)) continue;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }
  return colors;
}

function sizesFor(piece: BundleProduct, color: string | null) {
  const matches = piece.variants.filter((variant) => variant.colorName === color);
  const bySize = new Map<string, PieceVariant>();
  for (const variant of matches) {
    const current = bySize.get(variant.size);
    if (!current || variant.inventoryQty > current.inventoryQty) {
      bySize.set(variant.size, variant);
    }
  }
  return sortSizes([...bySize.values()]);
}

function startingPick(product: BundleProduct) {
  const colors = colorsOf(product);
  const color = colors.length === 1 ? colors[0].name : null;
  const sizes = sizesFor(product, color);
  const size = color && sizes.length === 1 ? sizes[0].size : null;
  return { color, size };
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

  if (!pack) throw data("Bundle not found", { status: 404 });

  const resolved = resolveStorefrontPackProducts(
    pack.items.map((item) => ({
      isPrimary: item.isPrimary,
      sortOrder: item.sortOrder,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            basePrice: item.product.basePrice,
            status: item.product.status,
            variants: item.product.variants,
          }
        : null,
      bundle: item.bundle
        ? {
            name: item.bundle.name,
            products: item.bundle.products.map((piece) => ({
              role: piece.role,
              sortOrder: piece.sortOrder,
              product: {
                id: piece.product.id,
                name: piece.product.name,
                basePrice: piece.product.basePrice,
                status: piece.product.status,
                variants: piece.product.variants,
              },
            })),
          }
        : null,
    }))
  );

  if (resolved.length < 2) throw data("Bundle not found", { status: 404 });

  const variantByProductId = new Map(
    pack.items
      .filter((item) => item.product)
      .map((item) => [item.product!.id, item.product!.variants] as const)
  );

  // Legacy set expansion: variants live on bundle.products
  if (variantByProductId.size === 0 && pack.items.some((item) => item.bundle)) {
    for (const item of pack.items) {
      for (const piece of item.bundle?.products ?? []) {
        variantByProductId.set(piece.product.id, piece.product.variants);
      }
    }
  }

  const products = resolved.map((product) =>
    toBundleProduct(product, variantByProductId.get(product.id))
  );

  return {
    pack: {
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      discountType: pack.discountType,
      discountValue: Number(pack.discountValue),
      products,
    },
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export default function BundleDetail({ loaderData }: Route.ComponentProps) {
  const { pack, cloudName } = loaderData;
  const addPack = useCart((state) => state.addPack);
  const [picks, setPicks] = useState<Record<string, { color: string | null; size: string | null }>>(
    () => Object.fromEntries(pack.products.map((product) => [product.id, startingPick(product)]))
  );
  const [quantity, setQuantity] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const selections = pack.products.map((product) => {
    const pick = picks[product.id] ?? { color: null, size: null };
    const variant = sizesFor(product, pick.color).find((item) => item.size === pick.size) ?? null;
    return { product, pick, variant };
  });

  const partPrices = selections.map(
    (item) => item.variant?.price ?? item.product.basePrice
  );
  const priced = allocatePrices(partPrices, pack.discountType, pack.discountValue);
  const undiscounted = partPrices.reduce((sum, price) => sum + price, 0);

  const allChosen = selections.every((item) => item.variant);
  const allReady = selections.every(
    (item) => item.variant && item.variant.inventoryQty > 0
  );
  const canAdd = allChosen && allReady;
  const incomplete = selections.find((item) => !item.variant);
  const oos = selections.find(
    (item) => item.variant && item.variant.inventoryQty <= 0
  );
  const maxQty = canAdd
    ? Math.max(1, Math.min(...selections.map((item) => item.variant!.inventoryQty)))
    : 1;

  const images = useMemo(() => {
    const ordered = [
      ...selections.filter((item) => item.product.isPrimary),
      ...selections.filter((item) => !item.product.isPrimary),
    ];
    return ordered.flatMap((item) => {
      if (item.variant?.images.length) return item.variant.images;
      const colors = colorsOf(item.product);
      const fallbackColor = item.pick.color ?? colors[0]?.name ?? null;
      return sizesFor(item.product, fallbackColor)[0]?.images ?? item.product.variants[0]?.images ?? [];
    });
  }, [selections]);

  const cloud = cloudName ?? "demo";
  const imageSrc = (publicId: string, width: number) =>
    `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
  const shown = images[Math.min(activeImage, Math.max(images.length - 1, 0))];

  function updatePick(id: string, next: { color: string | null; size: string | null }) {
    setPicks((current) => ({ ...current, [id]: next }));
    setQuantity(1);
    setActiveImage(0);
  }

  function handleAdd() {
    if (!canAdd) return;
    const chosen = selections.map((item) => item.variant!);
    const groupId = [pack.slug, ...chosen.map((variant) => variant.id)].join(":");
    const shares = allocatePrices(
      chosen.map((variant) => variant.price),
      pack.discountType,
      pack.discountValue
    );

    addPack(
      chosen.map((variant, index) => {
        const product = selections[index].product;
        return {
          packGroupId: groupId,
          variantId: variant.id,
          productId: product.id,
          productName: `${pack.name} · ${product.name}`,
          variantLabel: getVariantLabel(variant.colorName, variant.size),
          colorHex: variant.colorHex,
          price: shares.shares[index] ?? variant.price,
          imagePublicId: variant.images[0]?.publicId,
          imageAlt: variant.images[0]?.altText || product.name,
          quantity,
        };
      })
    );
  }

  const addLabel = incomplete
    ? `Select ${incomplete.product.name}`
    : oos
      ? "Out of stock"
      : `${formatCurrency(priced.total)} · Add to bag`;

  const primaryHex =
    selections.find((item) => item.product.isPrimary)?.variant?.colorHex ??
    selections[0]?.variant?.colorHex ??
    selections[0]?.product.variants[0]?.colorHex;
  const ctaStyle = ctaFromHex(primaryHex);

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: pack.name,
          description: pack.description ?? pack.name,
          slug: pack.slug,
          path: `/bundles/${pack.slug}`,
          price: priced.total,
          inStock: canAdd,
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
                {pack.products.map((product) => product.name).join(" · ")}
              </p>
              <p className="mt-4 text-lg font-medium text-charcoal">
                {formatCurrency(priced.total)}
                {priced.total < undiscounted && (
                  <span className="ml-2 text-base font-normal text-charcoal/35 line-through">
                    {formatCurrency(undiscounted)}
                  </span>
                )}
              </p>

              <div className="mt-8 rounded-lg border border-charcoal/10 bg-sand/40 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-charcoal/55">
                  Includes
                </p>
                <ul className="mt-3 space-y-3">
                  {pack.products.map((product) => {
                    const thumb =
                      product.variants.find((variant) => variant.images.length > 0)?.images[0] ??
                      null;
                    return (
                      <li key={product.id} className="flex items-center gap-3">
                        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-stone">
                          {thumb ? (
                            <img
                              src={imageSrc(thumb.publicId, 96)}
                              alt={thumb.altText || product.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-charcoal">
                            {product.name}
                            {product.isPrimary && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal/45">
                                Primary
                              </span>
                            )}
                          </p>
                          <p className="text-[12px] text-charcoal/55">
                            {formatCurrency(product.basePrice)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selections.map(({ product, pick }) => {
                const colors = colorsOf(product);
                const sizes = sizesFor(product, pick.color);
                const showSizeChart = !product.name.toLowerCase().includes("bag");
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "mt-10 border-t border-charcoal/10 pt-8 first:mt-8 first:border-t-0 first:pt-0"
                    )}
                  >
                    <h2 className="text-[15px] font-medium text-charcoal">
                      {product.name}
                      {product.isPrimary && (
                        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal/45">
                          Primary
                        </span>
                      )}
                    </h2>
                    {colors.length > 0 && (
                      <OptionRow
                        label="Colour"
                        selected={pick.color}
                        options={colors.map((item) => {
                          const itemSizes = sizesFor(product, item.name);
                          return {
                            id: item.name,
                            label: item.name,
                            swatch: item.hex,
                            disabled:
                              itemSizes.length > 0 &&
                              itemSizes.every((variant) => variant.inventoryQty <= 0),
                          };
                        })}
                        onSelect={(next) => {
                          const nextSizes = sizesFor(product, next);
                          updatePick(product.id, {
                            color: next,
                            size: nextSizes.length === 1 ? nextSizes[0].size : null,
                          });
                        }}
                      />
                    )}
                    {pick.color && sizes.length > 0 && (
                      <OptionRow
                        label="Size"
                        selected={pick.size}
                        options={sizes.map((variant) => ({
                          id: variant.size,
                          label: variant.size,
                          disabled: variant.inventoryQty <= 0,
                        }))}
                        onSelect={(size) =>
                          updatePick(product.id, { color: pick.color, size })
                        }
                        onChart={
                          showSizeChart ? () => setChartOpen(true) : undefined
                        }
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
                  style={ctaStyle}
                  className={cn(
                    "h-14 flex-1 text-[13px] font-semibold uppercase tracking-[0.16em] transition-opacity",
                    !canAdd && "opacity-90"
                  )}
                >
                  {addLabel}
                </button>
              </div>
              {!allChosen && incomplete && (
                <p className="mt-2 text-center text-[12px] text-charcoal/55">
                  Still need a selection for {incomplete.product.name}.
                </p>
              )}
              <p className="mt-3 text-center text-[12px] text-charcoal/45">
                HST applied at checkout.{" "}
                <Link
                  to="/policies/returns"
                  className="underline underline-offset-4 hover:text-navy"
                >
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
          style={ctaStyle}
          className={cn(
            "h-12 w-full text-[12px] font-semibold uppercase tracking-[0.14em] transition-opacity",
            !canAdd && "opacity-90"
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
