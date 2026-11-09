import { useMemo, useState } from "react";
import type { Route } from "./+types/bundle-detail";
import { data, Link } from "react-router";
import { ProductGallery } from "~/components/storefront/ProductGallery";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { useCart } from "~/lib/cart";
import { resolveStorefrontPackUnits } from "~/lib/packs.server";
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

type PieceProduct = {
  id: string;
  name: string;
  basePrice: number;
  variants: PieceVariant[];
};

type BundleUnit =
  | {
      kind: "product";
      key: string;
      id: string;
      name: string;
      basePrice: number;
      isPrimary: boolean;
      variants: PieceVariant[];
    }
  | {
      kind: "set";
      key: string;
      bundleId: string;
      name: string;
      isPrimary: boolean;
      top: PieceProduct;
      pants: PieceProduct;
    };

type ProductPick = { color: string | null; size: string | null };
type SetPick = { color: string | null; topSize: string | null; pantsSize: string | null };

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.pack) return [{ title: "Bundle not found — shiftshappn" }];
  return buildMeta({
    title: `${loaderData.pack.name} — shiftshappn`,
    description: loaderData.pack.description ?? `${loaderData.pack.name} bundle`,
    path: `/bundles/${loaderData.pack.slug}`,
  });
}

function mapVariants(
  basePrice: number,
  variants: Array<{
    id?: string;
    colorName: string;
    colorHex: string;
    size?: string;
    inventoryQty?: number;
    priceOverride?: { toString(): string } | number | null;
    images: unknown;
  }>
): PieceVariant[] {
  return variants.map((variant) => ({
    id: String(variant.id ?? ""),
    colorName: variant.colorName,
    colorHex: variant.colorHex,
    size: String(variant.size ?? ""),
    inventoryQty: Number(variant.inventoryQty ?? 0),
    price:
      variant.priceOverride != null ? Number(variant.priceOverride) : basePrice,
    images: parseVariantImages(variant.images).map((image) => ({
      publicId: image.publicId,
      altText: image.altText,
    })),
  }));
}

function colorsOf(piece: { variants: PieceVariant[] }) {
  const seen = new Set<string>();
  const colors: Array<{ name: string; hex: string }> = [];
  for (const variant of piece.variants) {
    if (seen.has(variant.colorName)) continue;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }
  return colors;
}

function sharedColors(top: PieceProduct, pants: PieceProduct) {
  const pantsNames = new Set(pants.variants.map((variant) => variant.colorName));
  const seen = new Set<string>();
  const colors: Array<{ name: string; hex: string }> = [];
  for (const variant of top.variants) {
    if (!pantsNames.has(variant.colorName) || seen.has(variant.colorName)) continue;
    seen.add(variant.colorName);
    colors.push({ name: variant.colorName, hex: variant.colorHex });
  }
  return colors;
}

function sizesFor(piece: { variants: PieceVariant[] }, color: string | null) {
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

function startingProductPick(product: { variants: PieceVariant[] }): ProductPick {
  const colors = colorsOf(product);
  const color = colors.length === 1 ? colors[0].name : null;
  const sizes = sizesFor(product, color);
  const size = color && sizes.length === 1 ? sizes[0].size : null;
  return { color, size };
}

function startingSetPick(top: PieceProduct, pants: PieceProduct): SetPick {
  const colors = sharedColors(top, pants);
  const color = colors.length === 1 ? colors[0].name : null;
  const topSizes = sizesFor(top, color);
  const pantsSizes = sizesFor(pants, color);
  return {
    color,
    topSize: color && topSizes.length === 1 ? topSizes[0].size : null,
    pantsSize: color && pantsSizes.length === 1 ? pantsSizes[0].size : null,
  };
}

function unitLabel(unit: BundleUnit) {
  return unit.kind === "set" ? `${unit.name} set` : unit.name;
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

  const resolved = resolveStorefrontPackUnits(
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
            id: item.bundle.id,
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

  if (resolved.length < 1) throw data("Bundle not found", { status: 404 });

  const units: BundleUnit[] = resolved.map((unit) => {
    if (unit.kind === "product") {
      return {
        kind: "product" as const,
        key: `product:${unit.id}`,
        id: unit.id,
        name: unit.name,
        basePrice: unit.basePrice,
        isPrimary: unit.isPrimary,
        variants: mapVariants(unit.basePrice, unit.variants as PieceVariant[]),
      };
    }
    return {
      kind: "set" as const,
      key: `set:${unit.bundleId}`,
      bundleId: unit.bundleId,
      name: unit.name,
      isPrimary: unit.isPrimary,
      top: {
        id: unit.top.id,
        name: unit.top.name,
        basePrice: unit.top.basePrice,
        variants: mapVariants(unit.top.basePrice, unit.top.variants as PieceVariant[]),
      },
      pants: {
        id: unit.pants.id,
        name: unit.pants.name,
        basePrice: unit.pants.basePrice,
        variants: mapVariants(unit.pants.basePrice, unit.pants.variants as PieceVariant[]),
      },
    };
  });

  // A valid promo bundle needs at least two priced pieces after expansion
  const expandedCount = units.reduce(
    (count, unit) => count + (unit.kind === "set" ? 2 : 1),
    0
  );
  if (expandedCount < 2) throw data("Bundle not found", { status: 404 });

  return {
    pack: {
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      discountType: pack.discountType,
      discountValue: Number(pack.discountValue),
      units,
    },
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export default function BundleDetail({ loaderData }: Route.ComponentProps) {
  const { pack, cloudName } = loaderData;
  const addPack = useCart((state) => state.addPack);

  const [productPicks, setProductPicks] = useState<Record<string, ProductPick>>(() =>
    Object.fromEntries(
      pack.units
        .filter((unit): unit is Extract<BundleUnit, { kind: "product" }> => unit.kind === "product")
        .map((unit) => [unit.key, startingProductPick(unit)])
    )
  );
  const [setPicks, setSetPicks] = useState<Record<string, SetPick>>(() =>
    Object.fromEntries(
      pack.units
        .filter((unit): unit is Extract<BundleUnit, { kind: "set" }> => unit.kind === "set")
        .map((unit) => [unit.key, startingSetPick(unit.top, unit.pants)])
    )
  );
  const [quantity, setQuantity] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  type ChosenLine = {
    unitKey: string;
    unitLabel: string;
    productId: string;
    productName: string;
    setGroupId?: string;
    setRole?: "top" | "pants";
    variant: PieceVariant;
  };

  const chosenLines: Array<ChosenLine | null> = pack.units.flatMap((unit) => {
    if (unit.kind === "product") {
      const pick = productPicks[unit.key] ?? { color: null, size: null };
      const variant =
        sizesFor(unit, pick.color).find((item) => item.size === pick.size) ?? null;
      if (!variant) return [null];
      return [
        {
          unitKey: unit.key,
          unitLabel: unit.name,
          productId: unit.id,
          productName: unit.name,
          variant,
        },
      ];
    }

    const pick = setPicks[unit.key] ?? {
      color: null,
      topSize: null,
      pantsSize: null,
    };
    const topVariant =
      sizesFor(unit.top, pick.color).find((item) => item.size === pick.topSize) ?? null;
    const pantsVariant =
      sizesFor(unit.pants, pick.color).find((item) => item.size === pick.pantsSize) ??
      null;
    const setGroupId = `${pack.slug}:set:${unit.bundleId}`;
    return [
      topVariant
        ? {
            unitKey: unit.key,
            unitLabel: `${unit.name} set`,
            productId: unit.top.id,
            productName: `${unit.name} set · Top`,
            setGroupId,
            setRole: "top" as const,
            variant: topVariant,
          }
        : null,
      pantsVariant
        ? {
            unitKey: unit.key,
            unitLabel: `${unit.name} set`,
            productId: unit.pants.id,
            productName: `${unit.name} set · Pants`,
            setGroupId,
            setRole: "pants" as const,
            variant: pantsVariant,
          }
        : null,
    ];
  });

  const readyLines = chosenLines.filter((line): line is ChosenLine => Boolean(line));
  const expectedLineCount = pack.units.reduce(
    (count, unit) => count + (unit.kind === "set" ? 2 : 1),
    0
  );
  const allChosen = readyLines.length === expectedLineCount;
  const allReady = allChosen && readyLines.every((line) => line.variant.inventoryQty > 0);
  const canAdd = allChosen && allReady;

  const estimateParts = pack.units.flatMap((unit) => {
    if (unit.kind === "product") {
      const pick = productPicks[unit.key];
      const variant = pick
        ? sizesFor(unit, pick.color).find((item) => item.size === pick.size)
        : null;
      return [variant?.price ?? unit.basePrice];
    }
    const pick = setPicks[unit.key];
    const topVariant = pick
      ? sizesFor(unit.top, pick.color).find((item) => item.size === pick.topSize)
      : null;
    const pantsVariant = pick
      ? sizesFor(unit.pants, pick.color).find((item) => item.size === pick.pantsSize)
      : null;
    return [
      topVariant?.price ?? unit.top.basePrice,
      pantsVariant?.price ?? unit.pants.basePrice,
    ];
  });
  const priced = allocatePrices(estimateParts, pack.discountType, pack.discountValue);
  const undiscounted = estimateParts.reduce((sum, price) => sum + price, 0);

  const incompleteUnit = pack.units.find((unit) => {
    if (unit.kind === "product") {
      const pick = productPicks[unit.key];
      return !pick?.color || !pick.size;
    }
    const pick = setPicks[unit.key];
    return !pick?.color || !pick.topSize || !pick.pantsSize;
  });
  const oos = readyLines.find((line) => line.variant.inventoryQty <= 0);
  const maxQty = canAdd
    ? Math.max(1, Math.min(...readyLines.map((line) => line.variant.inventoryQty)))
    : 1;

  const images = useMemo(() => {
    const collected: Array<{ publicId: string; altText: string }> = [];
    const seen = new Set<string>();
    const push = (list: Array<{ publicId: string; altText: string }>) => {
      for (const image of list) {
        if (seen.has(image.publicId)) continue;
        seen.add(image.publicId);
        collected.push(image);
      }
    };

    const ordered = [
      ...pack.units.filter((unit) => unit.isPrimary),
      ...pack.units.filter((unit) => !unit.isPrimary),
    ];

    for (const unit of ordered) {
      if (unit.kind === "product") {
        const pick = productPicks[unit.key];
        const variant = pick
          ? sizesFor(unit, pick.color).find((item) => item.size === pick.size)
          : null;
        if (variant?.images.length) {
          push(variant.images);
          continue;
        }
        const color = pick?.color ?? colorsOf(unit)[0]?.name ?? null;
        push(sizesFor(unit, color)[0]?.images ?? unit.variants[0]?.images ?? []);
        continue;
      }

      const pick = setPicks[unit.key];
      const color = pick?.color ?? sharedColors(unit.top, unit.pants)[0]?.name ?? null;
      const topVariant = pick?.topSize
        ? sizesFor(unit.top, color).find((item) => item.size === pick.topSize)
        : null;
      const pantsVariant = pick?.pantsSize
        ? sizesFor(unit.pants, color).find((item) => item.size === pick.pantsSize)
        : null;
      push(topVariant?.images.length ? topVariant.images : sizesFor(unit.top, color)[0]?.images ?? []);
      push(
        pantsVariant?.images.length
          ? pantsVariant.images
          : sizesFor(unit.pants, color)[0]?.images ?? []
      );
    }

    return collected;
  }, [pack.units, productPicks, setPicks]);

  const cloud = cloudName ?? "demo";
  const imageSrc = (publicId: string, width: number) =>
    `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
  const shown = images[Math.min(activeImage, Math.max(images.length - 1, 0))];

  function updateProductPick(key: string, next: ProductPick) {
    setProductPicks((current) => ({ ...current, [key]: next }));
    setQuantity(1);
    setActiveImage(0);
  }

  function updateSetPick(key: string, next: SetPick) {
    setSetPicks((current) => ({ ...current, [key]: next }));
    setQuantity(1);
    setActiveImage(0);
  }

  function handleAdd() {
    if (!canAdd) return;
    const groupId = [
      pack.slug,
      ...readyLines.map((line) => line.variant.id),
    ].join(":");
    const shares = allocatePrices(
      readyLines.map((line) => line.variant.price),
      pack.discountType,
      pack.discountValue
    );

    addPack(
      readyLines.map((line, index) => ({
        packGroupId: groupId,
        setGroupId: line.setGroupId
          ? `${groupId}:${line.setGroupId}`
          : undefined,
        setRole: line.setRole,
        variantId: line.variant.id,
        productId: line.productId,
        productName: `${pack.name} · ${line.productName}`,
        variantLabel: getVariantLabel(line.variant.colorName, line.variant.size),
        colorHex: line.variant.colorHex,
        price: shares.shares[index] ?? line.variant.price,
        imagePublicId: line.variant.images[0]?.publicId,
        imageAlt: line.variant.images[0]?.altText || line.productName,
        quantity,
      }))
    );
  }

  const addLabel = incompleteUnit
    ? `Select ${unitLabel(incompleteUnit)}`
    : oos
      ? "Out of stock"
      : `${formatCurrency(priced.total)} · Add to bag`;

  const primaryHex = (() => {
    const primary = pack.units.find((unit) => unit.isPrimary) ?? pack.units[0];
    if (!primary) return undefined;
    if (primary.kind === "product") {
      const pick = productPicks[primary.key];
      return (
        sizesFor(primary, pick?.color ?? null).find((item) => item.size === pick?.size)
          ?.colorHex ?? primary.variants[0]?.colorHex
      );
    }
    const pick = setPicks[primary.key];
    return (
      sizesFor(primary.top, pick?.color ?? null).find((item) => item.size === pick?.topSize)
        ?.colorHex ?? primary.top.variants[0]?.colorHex
    );
  })();
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
                {pack.units.map((unit) => unitLabel(unit)).join(" · ")}
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
                  {pack.units.map((unit) => {
                    const thumb =
                      unit.kind === "product"
                        ? unit.variants.find((variant) => variant.images.length > 0)?.images[0]
                        : unit.top.variants.find((variant) => variant.images.length > 0)
                            ?.images[0];
                    return (
                      <li key={unit.key} className="flex items-center gap-3">
                        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-stone">
                          {thumb ? (
                            <img
                              src={imageSrc(thumb.publicId, 96)}
                              alt={thumb.altText || unitLabel(unit)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-charcoal">
                            {unitLabel(unit)}
                            {unit.isPrimary && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal/45">
                                Primary
                              </span>
                            )}
                          </p>
                          <p className="text-[12px] text-charcoal/55">
                            {formatCurrency(
                              unit.kind === "set"
                                ? unit.top.basePrice + unit.pants.basePrice
                                : unit.basePrice
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {pack.units.map((unit) => {
                if (unit.kind === "product") {
                  const pick = productPicks[unit.key] ?? { color: null, size: null };
                  const colors = colorsOf(unit);
                  const sizes = sizesFor(unit, pick.color);
                  const showSizeChart = !unit.name.toLowerCase().includes("bag");
                  return (
                    <div
                      key={unit.key}
                      className="mt-10 border-t border-charcoal/10 pt-8 first:mt-8 first:border-t-0 first:pt-0"
                    >
                      <h2 className="text-[15px] font-medium text-charcoal">
                        {unit.name}
                        {unit.isPrimary && (
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
                            const itemSizes = sizesFor(unit, item.name);
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
                            const nextSizes = sizesFor(unit, next);
                            updateProductPick(unit.key, {
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
                            updateProductPick(unit.key, { color: pick.color, size })
                          }
                          onChart={showSizeChart ? () => setChartOpen(true) : undefined}
                        />
                      )}
                    </div>
                  );
                }

                const pick = setPicks[unit.key] ?? {
                  color: null,
                  topSize: null,
                  pantsSize: null,
                };
                const colors = sharedColors(unit.top, unit.pants);
                const topSizes = sizesFor(unit.top, pick.color);
                const pantsSizes = sizesFor(unit.pants, pick.color);

                return (
                  <div
                    key={unit.key}
                    className="mt-10 border-t border-charcoal/10 pt-8 first:mt-8 first:border-t-0 first:pt-0"
                  >
                    <h2 className="text-[15px] font-medium text-charcoal">
                      {unit.name} set
                      {unit.isPrimary && (
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
                          const tops = sizesFor(unit.top, item.name);
                          const pants = sizesFor(unit.pants, item.name);
                          return {
                            id: item.name,
                            label: item.name,
                            swatch: item.hex,
                            disabled:
                              (tops.length > 0 &&
                                tops.every((variant) => variant.inventoryQty <= 0)) ||
                              (pants.length > 0 &&
                                pants.every((variant) => variant.inventoryQty <= 0)),
                          };
                        })}
                        onSelect={(next) => {
                          const nextTop = sizesFor(unit.top, next);
                          const nextPants = sizesFor(unit.pants, next);
                          updateSetPick(unit.key, {
                            color: next,
                            topSize: nextTop.length === 1 ? nextTop[0].size : null,
                            pantsSize: nextPants.length === 1 ? nextPants[0].size : null,
                          });
                        }}
                      />
                    )}
                    {pick.color && topSizes.length > 0 && (
                      <OptionRow
                        label="Top size"
                        selected={pick.topSize}
                        options={topSizes.map((variant) => ({
                          id: variant.size,
                          label: variant.size,
                          disabled: variant.inventoryQty <= 0,
                        }))}
                        onSelect={(topSize) =>
                          updateSetPick(unit.key, { ...pick, topSize })
                        }
                        onChart={() => setChartOpen(true)}
                      />
                    )}
                    {pick.color && pantsSizes.length > 0 && (
                      <OptionRow
                        label="Pants size"
                        selected={pick.pantsSize}
                        options={pantsSizes.map((variant) => ({
                          id: variant.size,
                          label: variant.size,
                          disabled: variant.inventoryQty <= 0,
                        }))}
                        onSelect={(pantsSize) =>
                          updateSetPick(unit.key, { ...pick, pantsSize })
                        }
                        onChart={() => setChartOpen(true)}
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
              {!allChosen && incompleteUnit && (
                <p className="mt-2 text-center text-[12px] text-charcoal/55">
                  Still need a selection for {unitLabel(incompleteUnit)}.
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
