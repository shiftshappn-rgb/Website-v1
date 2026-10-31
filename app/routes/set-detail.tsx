import { useMemo, useState } from "react";
import type { Route } from "./+types/set-detail";
import { data, Link, useActionData, useSearchParams } from "react-router";
import { ProductGallery } from "~/components/storefront/ProductGallery";
import { ProductInfoTabs } from "~/components/storefront/ProductInfoTabs";
import { ProductReviewsSection } from "~/components/storefront/ProductReviewsSection";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { StarRating } from "~/components/storefront/StarRating";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { productCardSelect } from "~/lib/catalog.server";
import { useCart } from "~/lib/cart";
import { submitProductReview } from "~/lib/review-submit.server";
import { dedupeReviews, serializeReview } from "~/lib/reviews";
import { getCustomerNav } from "~/lib/session.server";
import { customerHasVerifiedPurchase } from "~/lib/verified-purchase.server";
import { piecePrices, sortSizes } from "~/lib/sets";
import { buildMeta, breadcrumbJsonLd, JsonLd, productJsonLd } from "~/lib/seo";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { serializeProductForCard } from "~/lib/serialize.server";
import { DEFAULT_LENGTH_GUIDE } from "~/lib/size-chart";
import { cn, ctaFromHex, formatCurrency, parseVariantImages } from "~/lib/utils";

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
  slug: string;
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
  const database = db;

  const bundle = await database.bundle.findUnique({
    where: { slug: params.slug },
    include: {
      products: {
        include: {
          product: {
            include: {
              variants: true,
              fabricType: true,
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
    slug: link.product.slug,
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

  const infoProduct = topLink.product;
  const excludeIds = [top.id, pants.id];
  const audienceCategoryId =
    category?.parentCategoryId ?? category?.id ?? null;

  async function findWearWith(status?: "active") {
    const audienceFilter = audienceCategoryId
      ? {
          OR: [
            { category: { slug: "accessories" } },
            { categoryId: audienceCategoryId },
            { category: { parentCategoryId: audienceCategoryId } },
          ],
        }
      : { category: { slug: "accessories" } };

    return database.product.findMany({
      where: {
        id: { notIn: excludeIds },
        ...audienceFilter,
        ...(status ? { status } : {}),
      },
      take: 1,
      orderBy: { updatedAt: "desc" },
      select: productCardSelect,
    });
  }

  const pieceIds = [top.id, pants.id];

  const [activeWearWith, reviewRows, customer] = await Promise.all([
    findWearWith("active"),
    database.review.findMany({
      where: {
        status: "approved",
        productId: { in: pieceIds },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    getCustomerNav(request),
  ]);

  let wearWithRows = activeWearWith;
  if (wearWithRows.length === 0) wearWithRows = await findWearWith();
  if (wearWithRows.length === 0) {
    wearWithRows = await database.product.findMany({
      where: { id: { notIn: excludeIds } },
      take: 1,
      orderBy: { updatedAt: "desc" },
      select: productCardSelect,
    });
  }

  const reviews = dedupeReviews(reviewRows.map(serializeReview));
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  const verifiedPurchase = customer
    ? await customerHasVerifiedPurchase(database, customer.id, pieceIds)
    : false;

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
      shortDescription: infoProduct.shortDescription,
      fitSummary: infoProduct.fitSummary,
      careInstructions: infoProduct.careInstructions,
      fabricName: infoProduct.fabricType?.name ?? null,
      fabricDescription: infoProduct.fabricType?.description ?? null,
    },
    wearWith: wearWithRows.map(serializeProductForCard)[0] ?? null,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    initialColor:
      (requested && colors.some((color) => color.name === requested) ? requested : null) ??
      colors.find((color) => colorHasImages(color.name))?.name ??
      colors[0]?.name ??
      null,
    reviews,
    avgRating,
    reviewer: {
      name: customer?.name?.trim() || "",
      isSignedIn: Boolean(customer),
      verifiedPurchase,
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Reviews are unavailable right now." };
  }

  const db = tryDb();
  if (!db) {
    return { error: "Reviews are unavailable right now." };
  }

  const bundle = await db.bundle.findUnique({
    where: { slug: params.slug },
    include: {
      products: {
        select: {
          role: true,
          productId: true,
        },
      },
    },
  });

  if (!bundle) {
    return { error: "Set not found." };
  }

  const topId = bundle.products.find((item) => item.role === "top")?.productId;
  const pantsId = bundle.products.find((item) => item.role === "pants")?.productId;
  if (!topId) {
    return { error: "Set not found." };
  }

  return submitProductReview({
    db,
    request,
    productId: topId,
    verifiedAgainstProductIds: [topId, ...(pantsId ? [pantsId] : [])],
    // Mirror onto pants so the review appears on both piece PDPs (and admin).
    mirrorToProductIds: pantsId ? [pantsId] : [],
  });
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
  const { set, cloudName, initialColor, wearWith, reviews, avgRating, reviewer } = loaderData;
  const actionData = useActionData<typeof action>();
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

  const ctaStyle = ctaFromHex(
    set.colors.find((color) => color.name === selectedColor)?.hex
  );

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

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <a href="#reviews" className="inline-flex items-center gap-2">
                  <StarRating value={avgRating ?? 0} size={14} />
                  <span className="text-[13px] text-charcoal/55">
                    {avgRating != null
                      ? `${avgRating.toFixed(1)} (${reviews.length} review${reviews.length === 1 ? "" : "s"})`
                      : "No reviews yet"}
                  </span>
                </a>
                <a
                  href="#write-review"
                  className="text-[13px] font-medium text-navy underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                >
                  Write a review
                </a>
              </div>

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
                  style={ctaStyle}
                  className={cn(
                    "h-14 flex-1 text-[13px] font-semibold uppercase tracking-[0.16em] transition-opacity",
                    !canAdd && "opacity-90"
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

              <ProductInfoTabs
                intro={`Built for long shifts — the ${set.name} set pairs a soft stretch scrub top and pants with pockets that actually hold what you carry.`}
                features={detailLines}
                fitSummary={set.fitSummary}
                lengthGuide={DEFAULT_LENGTH_GUIDE}
                fabricName={set.fabricName}
                fabricDescription={set.fabricDescription}
                careInstructions={set.careInstructions}
                onOpenSizeChart={() => setChartOpen(true)}
              />
            </div>
          </div>

          {wearWith && (
            <section className="mt-8 border-t border-charcoal/10 pt-12 lg:mt-14">
              <h2 className="mb-8 text-2xl font-semibold tracking-tight text-charcoal">
                Wear it with
              </h2>
              <div className="grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
                <Link to={`/products/${wearWith.slug}`} className="bg-[#f6f6f4]">
                  {wearWith.imagePublicId ? (
                    <img
                      src={imageSrc(wearWith.imagePublicId, 480)}
                      alt={wearWith.imageAlt ?? wearWith.name}
                      className="aspect-3/4 w-full object-contain"
                    />
                  ) : (
                    <div className="aspect-3/4 w-full bg-[#f6f6f4]" aria-hidden />
                  )}
                </Link>
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        to={`/products/${wearWith.slug}`}
                        className="text-[15px] font-medium text-charcoal"
                      >
                        {wearWith.name}
                      </Link>
                      <p className="mt-1 text-[13px] text-charcoal/50">
                        {formatCurrency(wearWith.basePrice)}
                      </p>
                    </div>
                    <Link
                      to={`/products/${wearWith.slug}`}
                      className="hidden h-12 shrink-0 items-center bg-charcoal px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white sm:inline-flex"
                    >
                      Shop this style
                    </Link>
                  </div>
                  {wearWith.colors.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {wearWith.colors.slice(0, 10).map((color) => (
                        <Link
                          key={color.name}
                          to={`/products/${wearWith.slug}?color=${encodeURIComponent(color.name)}`}
                          className="size-6 rounded-full border border-black/10"
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  )}
                  <Link
                    to={`/products/${wearWith.slug}`}
                    className="mt-6 flex h-12 items-center justify-center border border-charcoal text-[13px] font-semibold uppercase tracking-[0.14em] sm:hidden"
                  >
                    Shop this style
                  </Link>
                </div>
              </div>
            </section>
          )}

          <ProductReviewsSection
            productSlug={set.top.slug}
            productName={`${set.name} set`}
            reviews={reviews}
            avgRating={avgRating}
            totalCount={reviews.length}
            previewLimit={6}
            showAllLink={reviews.length > 6}
            allReviewsHref={`/products/${set.top.slug}/reviews`}
            cloudName={cloudName}
            reviewer={reviewer}
            submitted={actionData?.submitted}
            error={actionData?.error}
          />
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
