import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/product-detail";
import { data, Link, useActionData, useSearchParams } from "react-router";
import { ProductGallery } from "~/components/storefront/ProductGallery";
import { ProductInfoTabs } from "~/components/storefront/ProductInfoTabs";
import { ProductReviewsSection } from "~/components/storefront/ProductReviewsSection";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { StarRating } from "~/components/storefront/StarRating";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import {
  isAccessoriesCategory,
  isSimpleAccessorySku,
} from "~/lib/accessories";
import { productCardSelect } from "~/lib/catalog.server";
import { useCart } from "~/lib/cart";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { CATALOG_LENGTHS } from "~/lib/product-catalog";
import { getSharedReviewProductIds } from "~/lib/review-products.server";
import { dedupeReviews, serializeReview } from "~/lib/reviews";
import { submitProductReview } from "~/lib/review-submit.server";
import { getProductColors } from "~/lib/serialize";
import { serializeProduct, serializeProductForCard } from "~/lib/serialize.server";
import { getCustomerNav } from "~/lib/session.server";
import { customerHasVerifiedPurchase } from "~/lib/verified-purchase.server";
import {
  buildMeta,
  JsonLd,
  productJsonLd,
  breadcrumbJsonLd,
} from "~/lib/seo";
import { DEFAULT_LENGTH_GUIDE } from "~/lib/size-chart";
import {
  cn,
  ctaFromHex,
  formatCurrency,
  getVariantLabel,
} from "~/lib/utils";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.product) {
    return [{ title: "Product not found — shiftshappn" }];
  }
  const { product, cloudName } = loaderData;
  return buildMeta({
    title: product.seoTitle ?? `${product.name} — shiftshappn`,
    description: product.seoDescription ?? product.shortDescription ?? product.description.slice(0, 160),
    image: product.seoImage
      ? cloudinaryImageUrl(product.seoImage, cloudName, 1200) ?? product.seoImage
      : undefined,
    path: `/products/${product.slug}`,
  });
}

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    throw data("Product not found", { status: 404 });
  }

  const db = tryDb();
  if (!db) {
    throw data("Product not found", { status: 404 });
  }

  const product = await db.product.findUnique({
    where: { slug: params.slug, status: "active" },
    include: {
      variants: true,
      category: true,
      fabricType: true,
    },
  });

  if (!product) {
    throw data("Product not found", { status: 404 });
  }

  const reviewProductIds = await getSharedReviewProductIds(db, product.id);
  const requestedColor = new URL(request.url).searchParams.get("color");

  const [reviewRows, customer, relatedRows] = await Promise.all([
    db.review.findMany({
      where: { status: "approved", productId: { in: reviewProductIds } },
      orderBy: { createdAt: "desc" },
    }),
    getCustomerNav(request),
    db.product.findMany({
      where: {
        status: "active",
        id: { not: product.id },
        ...(product.categoryId ? { categoryId: product.categoryId } : {}),
      },
      take: 2,
      select: productCardSelect,
    }),
  ]);

  const reviews = dedupeReviews(reviewRows.map(serializeReview));
  const verifiedPurchase = customer
    ? await customerHasVerifiedPurchase(db, customer.id, reviewProductIds)
    : false;

  return {
    product: serializeProduct(product),
    reviews,
    avgRating:
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    initialColor: requestedColor,
    reviewer: {
      name: customer?.name?.trim() || "",
      isSignedIn: Boolean(customer),
      verifiedPurchase,
    },
    related: relatedRows.map(serializeProductForCard),
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

  const product = await db.product.findUnique({
    where: { slug: params.slug, status: "active" },
    select: { id: true },
  });
  if (!product) {
    return { error: "Product not found." };
  }

  const sharedIds = await getSharedReviewProductIds(db, product.id);
  return submitProductReview({
    db,
    request,
    productId: product.id,
    verifiedAgainstProductIds: sharedIds,
    // Keep set mates in sync when reviewing from a single piece page.
    mirrorToProductIds: sharedIds.filter((id) => id !== product.id),
  });
}

function resolveInitialColor(
  colors: Array<{ colorName: string }>,
  requestedColor: string | null
) {
  if (!requestedColor) return colors[0]?.colorName ?? "";
  const match = colors.find(
    (color) => color.colorName.toLowerCase() === requestedColor.toLowerCase()
  );
  return match?.colorName ?? colors[0]?.colorName ?? "";
}

export default function ProductDetail({ loaderData }: Route.ComponentProps) {
  const { product, reviews, avgRating, cloudName, initialColor, reviewer, related } =
    loaderData;
  const actionData = useActionData<typeof action>();
  const addItem = useCart((s) => s.addItem);
  const colors = getProductColors(product);
  const [, setSearchParams] = useSearchParams();
  const isAccessory = isAccessoriesCategory(product.category);
  const simpleSku = isAccessory && isSimpleAccessorySku(product.variants);

  const [selectedColor, setSelectedColor] = useState(() =>
    resolveInitialColor(colors, initialColor)
  );
  const sizesForColor = useMemo(
    () => product.variants.filter((v) => v.colorName === selectedColor),
    [product.variants, selectedColor]
  );
  const [selectedSize, setSelectedSize] = useState(() =>
    simpleSku ? (product.variants[0]?.size ?? "") : ""
  );
  const [selectedLength, setSelectedLength] = useState<(typeof CATALOG_LENGTHS)[number]>(
    "Straight"
  );
  const [quantity, setQuantity] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const selectedVariant = product.variants.find(
    (v) => v.colorName === selectedColor && v.size === selectedSize
  );

  const images = useMemo(() => {
    const forColor = product.variants.find(
      (v) => v.colorName === selectedColor && v.images.length > 0
    );
    if (forColor) return forColor.images;
    const fromVariants = product.variants.flatMap((v) => v.images).slice(0, 8);
    if (fromVariants.length > 0) return fromVariants;
    if (product.seoImage) {
      return [{ publicId: product.seoImage, altText: product.name, sortOrder: 0 }];
    }
    return [];
  }, [product.variants, product.seoImage, product.name, selectedColor]);

  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
    if (simpleSku) {
      setSelectedSize(product.variants[0]?.size ?? "");
    } else {
      setSelectedSize("");
    }
    setQuantity(1);
  }, [selectedColor, simpleSku, product.variants]);

  const inStock = selectedVariant ? selectedVariant.inventoryQty > 0 : true;
  const maxQty = Math.max(1, selectedVariant?.inventoryQty ?? 9);
  const displayPrice = selectedVariant?.price ?? product.basePrice;
  const lengthGuide = product.lengthGuide || DEFAULT_LENGTH_GUIDE;
  const canAdd = Boolean(selectedVariant && inStock);
  const fitLine =
    product.fitSummary?.split("\n")[0] ||
    (isAccessory ? null : "Classic fit. Runs true to size.");
  const detailLines = product.description
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  function selectColor(colorName: string) {
    setSelectedColor(colorName);
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set("color", colorName);
        return next;
      },
      { replace: true, preventScrollReset: true }
    );
  }

  function handleAddToCart() {
    if (!selectedVariant) return;
    const image = selectedVariant.images[0] ?? images[0];
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantLabel: getVariantLabel(
        selectedVariant.colorName,
        selectedVariant.size,
        product.offerLengths ? selectedLength : null
      ),
      colorHex: selectedVariant.colorHex,
      price: selectedVariant.price,
      imagePublicId: image?.publicId,
      imageAlt: image?.altText,
      quantity,
    });
  }

  const cloud = cloudName ?? "demo";
  const imageSrc = (publicId: string, width: number) =>
    `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;

  const addLabel =
    !simpleSku && !selectedSize
      ? "Select a size"
      : !inStock
        ? "Out of stock"
        : `${formatCurrency(displayPrice)} · Add to bag`;

  const ctaStyle = ctaFromHex(
    colors.find((color) => color.colorName === selectedColor)?.colorHex
  );

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: product.name,
          description: product.shortDescription ?? product.description,
          slug: product.slug,
          price: displayPrice,
          inStock,
          image: images[0] ? imageSrc(images[0].publicId, 1200) : undefined,
          rating: avgRating ?? undefined,
          reviewCount: reviews.length || undefined,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          ...(product.category
            ? [{ name: product.category.name, path: `/shop/${product.category.slug}` }]
            : []),
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />

      <div className="bg-white">
        <div className="mx-auto max-w-350 px-4 pb-36 pt-4 sm:px-6 lg:px-10 lg:pb-20 lg:pt-6">
          <nav className="mb-5 text-[13px] text-charcoal/45">
            <Link to="/shop" className="hover:text-charcoal">
              Shop
            </Link>
            {product.category && (
              <>
                <span className="px-1.5">/</span>
                <Link
                  to={`/shop/${product.category.slug}`}
                  className="hover:text-charcoal"
                >
                  {product.category.name}
                </Link>
              </>
            )}
            <span className="px-1.5">/</span>
            <span className="text-charcoal/70">{product.name}</span>
          </nav>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,28rem)] lg:gap-16">
            <div className="lg:sticky lg:top-28">
              <ProductGallery
                images={images}
                activeIndex={activeImage}
                onChange={setActiveImage}
                alt={product.name}
                imageSrc={imageSrc}
              />
            </div>

            <div>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-charcoal">
                {product.name}
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
                {formatCurrency(displayPrice)}
                {product.compareAtPrice != null && product.compareAtPrice > displayPrice && (
                  <span className="ml-2 text-base font-normal text-charcoal/35 line-through">
                    {formatCurrency(product.compareAtPrice)}
                  </span>
                )}
              </p>

              {!simpleSku && (
                <div className="mt-8">
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <p className="text-[13px] text-charcoal">
                      Colour: <span className="font-medium">{selectedColor}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {colors.map((color) => (
                      <button
                        key={color.colorName}
                        type="button"
                        onClick={() => selectColor(color.colorName)}
                        className={cn(
                          "size-7 rounded-full border border-black/10",
                          selectedColor === color.colorName &&
                            "ring-1 ring-charcoal ring-offset-2"
                        )}
                        style={{ backgroundColor: color.colorHex }}
                        title={color.colorName}
                        aria-label={color.colorName}
                        aria-pressed={selectedColor === color.colorName}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!simpleSku && (
                <div className="mt-8">
                  <div className="mb-3 flex items-baseline justify-between">
                    <p className="text-[13px] text-charcoal">
                      {selectedSize ? `Size: ${selectedSize}` : "Select a size"}
                    </p>
                    {!isAccessory && (
                      <button
                        type="button"
                        onClick={() => setChartOpen(true)}
                        className="text-[13px] text-charcoal underline underline-offset-4"
                      >
                        Size chart
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizesForColor.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={variant.inventoryQty <= 0}
                        onClick={() => {
                          setSelectedSize(variant.size);
                          setQuantity(1);
                        }}
                        className={cn(
                          "flex h-10 min-w-12 items-center justify-center rounded-md border px-3 text-[13px]",
                          selectedSize === variant.size
                            ? "border-charcoal bg-charcoal text-white"
                            : "border-charcoal/20 bg-white text-charcoal hover:border-charcoal",
                          variant.inventoryQty <= 0 &&
                            "cursor-not-allowed line-through opacity-35"
                        )}
                      >
                        {variant.size}
                      </button>
                    ))}
                  </div>
                  {fitLine && (
                    <p className="mt-3 text-[13px] text-charcoal/55">{fitLine}</p>
                  )}
                </div>
              )}

              {product.offerLengths && !isAccessory && (
                <div className="mt-8">
                  <p className="mb-3 text-[13px] text-charcoal">
                    Length: {selectedLength}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {CATALOG_LENGTHS.map((length) => (
                      <button
                        key={length}
                        type="button"
                        onClick={() => setSelectedLength(length)}
                        className={cn(
                          "h-12 border text-[13px]",
                          selectedLength === length
                            ? "border-charcoal border-b-2"
                            : "border-charcoal/20"
                        )}
                      >
                        {length}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-charcoal/45">{lengthGuide}</p>
                </div>
              )}

              <div className="mt-8 flex gap-2">
                <label className="sr-only" htmlFor="pdp-qty">
                  Quantity
                </label>
                <select
                  id="pdp-qty"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="h-14 w-16 appearance-none border border-charcoal/20 bg-white text-center text-sm"
                >
                  {Array.from({ length: Math.min(9, maxQty) }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddToCart}
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
            </div>
          </div>

          <div className="mt-16 max-w-3xl">
            <ProductInfoTabs
              intro={
                (() => {
                  const short = product.shortDescription?.trim() ?? "";
                  const looksLikeFeatures =
                    short.includes(" • ") || detailLines[0]?.includes(" • ");
                  if (short && !looksLikeFeatures) return short;
                  if (detailLines[0] && !detailLines[0].includes(" • ") && detailLines.length > 1) {
                    return detailLines[0];
                  }
                  return `Built for long shifts — the ${product.name} is soft stretch with pockets that actually hold what you carry.`;
                })()
              }
              features={
                detailLines[0]?.includes(" • ")
                  ? detailLines[0]
                      .split("•")
                      .map((line) => line.trim())
                      .filter(Boolean)
                  : detailLines.length > 1 && !detailLines[0].includes(" • ")
                    ? detailLines.slice(1)
                    : detailLines
              }
              fitSummary={product.fitSummary}
              lengthGuide={lengthGuide}
              fabricName={product.fabricType?.name}
              fabricDescription={product.fabricType?.description}
              careInstructions={product.careInstructions}
              onOpenSizeChart={() => setChartOpen(true)}
            />
          </div>

          <ProductReviewsSection
            productSlug={product.slug}
            productName={product.name}
            reviews={reviews}
            avgRating={avgRating}
            totalCount={reviews.length}
            cloudName={cloudName}
            reviewer={reviewer}
            submitted={actionData?.submitted}
            error={actionData?.error}
          />

          {related[0] && (
            <section className="mt-16 border-t border-charcoal/10 pt-12">
              <h2 className="mb-8 text-2xl font-semibold tracking-tight text-charcoal">
                Complete the set
              </h2>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <Link to={`/products/${related[0].slug}`} className="shrink-0">
                  <div className="h-40 w-32 bg-[#f6f6f4]">
                    {related[0].imagePublicId && (
                      <img
                        src={imageSrc(related[0].imagePublicId, 320)}
                        alt={related[0].imageAlt ?? related[0].name}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/products/${related[0].slug}`}
                    className="text-[15px] font-medium text-charcoal hover:underline"
                  >
                    {related[0].name}
                  </Link>
                  <p className="mt-1 text-[13px] text-charcoal/50">
                    {related[0].colors[0]?.name}
                  </p>
                  <p className="mt-3 text-[15px] text-charcoal">
                    {formatCurrency(related[0].basePrice)}
                  </p>
                  <Link
                    to={`/products/${related[0].slug}`}
                    className="mt-5 flex h-12 max-w-xs items-center justify-center border border-charcoal text-[13px] font-semibold uppercase tracking-[0.14em]"
                  >
                    Shop this style
                  </Link>
                </div>
              </div>
            </section>
          )}

          {related[1] && (
            <section className="mt-20 border-t border-charcoal/10 pt-12">
              <h2 className="mb-8 text-2xl font-semibold tracking-tight text-charcoal">
                Wear it with
              </h2>
              <div className="grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
                <Link to={`/products/${related[1].slug}`} className="bg-[#f6f6f4]">
                  {related[1].imagePublicId && (
                    <img
                      src={imageSrc(related[1].imagePublicId, 480)}
                      alt={related[1].imageAlt ?? related[1].name}
                      className="aspect-3/4 w-full object-contain"
                    />
                  )}
                </Link>
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        to={`/products/${related[1].slug}`}
                        className="text-[15px] font-medium text-charcoal"
                      >
                        {related[1].name}
                      </Link>
                      <p className="mt-1 text-[13px] text-charcoal/50">
                        {formatCurrency(related[1].basePrice)}
                      </p>
                    </div>
                    <Link
                      to={`/products/${related[1].slug}`}
                      className="hidden h-12 shrink-0 items-center bg-charcoal px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white sm:inline-flex"
                    >
                      Add to bag
                    </Link>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {related[1].colors.slice(0, 10).map((color) => (
                      <Link
                        key={color.name}
                        to={`/products/${related[1].slug}?color=${encodeURIComponent(color.name)}`}
                        className="size-6 rounded-full border border-black/10"
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(17,26,34,0.06)] lg:hidden">
        <p className="mb-2 text-center text-[11px] text-charcoal/55">
          <Link to="/policies/returns" className="underline underline-offset-4">
            Free size exchange within 30 days.
          </Link>
        </p>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAdd}
          style={ctaStyle}
          className={cn(
            "flex h-13 w-full items-center justify-center text-[13px] font-semibold uppercase tracking-[0.16em] transition-opacity",
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
