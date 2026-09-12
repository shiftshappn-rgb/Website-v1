import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { Route } from "./+types/product-detail";
import { data, Link, useActionData, useSearchParams } from "react-router";
import { ReviewForm } from "~/components/storefront/ReviewForm";
import { SizeChartDrawer } from "~/components/storefront/SizeChartDrawer";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { productCardSelect } from "~/lib/catalog.server";
import { useCart } from "~/lib/cart";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { CATALOG_LENGTHS } from "~/lib/product-catalog";
import { serializeReview } from "~/lib/reviews";
import { getProductColors } from "~/lib/serialize";
import { serializeProduct, serializeProductForCard } from "~/lib/serialize.server";
import { getCustomer } from "~/lib/session.server";
import {
  buildMeta,
  JsonLd,
  productJsonLd,
  breadcrumbJsonLd,
} from "~/lib/seo";
import { DEFAULT_LENGTH_GUIDE } from "~/lib/size-chart";
import {
  cn,
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
      reviews: {
        where: { status: "approved" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) {
    throw data("Product not found", { status: 404 });
  }

  const serialized = serializeProduct(product);
  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : null;

  const requestedColor = new URL(request.url).searchParams.get("color");
  const customer = await getCustomer(request);
  const verifiedPurchase = customer
    ? Boolean(
        await db.orderItem.findFirst({
          where: {
            productVariant: { productId: product.id },
            order: {
              status: { in: ["paid", "fulfilled"] },
              OR: [{ customerId: customer.id }, { email: customer.email }],
            },
          },
          select: { id: true },
        })
      )
    : false;

  return {
    product: serialized,
    reviews: product.reviews.map(serializeReview),
    avgRating,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    initialColor: requestedColor,
    reviewer: {
      name: customer?.name?.trim() || "",
      isSignedIn: Boolean(customer),
      verifiedPurchase,
    },
    related: (
      await db.product.findMany({
        where: {
          status: "active",
          id: { not: product.id },
          ...(product.categoryId ? { categoryId: product.categoryId } : {}),
        },
        take: 2,
        select: productCardSelect,
      })
    ).map(serializeProductForCard),
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

  const formData = await request.formData();
  if (String(formData.get("intent") ?? "") !== "submit-review") {
    return { error: "Invalid review action." };
  }

  if (String(formData.get("website") ?? "").trim()) {
    return { submitted: true };
  }

  const product = await db.product.findUnique({
    where: { slug: params.slug, status: "active" },
    select: { id: true },
  });
  if (!product) {
    return { error: "Product not found." };
  }

  const customer = await getCustomer(request);
  const customerName =
    String(formData.get("customerName") ?? "").trim() || customer?.name?.trim() || "";
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const rating = parseInt(String(formData.get("rating") ?? "0"), 10);

  if (customerName.length < 2 || customerName.length > 80) {
    return { error: "Please enter your name." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Please choose a rating from 1 to 5." };
  }
  if (body.length < 20 || body.length > 2000) {
    return { error: "Write at least 20 characters about the product." };
  }

  const verifiedPurchase = customer
    ? Boolean(
        await db.orderItem.findFirst({
          where: {
            productVariant: { productId: product.id },
            order: {
              status: { in: ["paid", "fulfilled"] },
              OR: [{ customerId: customer.id }, { email: customer.email }],
            },
          },
          select: { id: true },
        })
      )
    : false;

  await db.review.create({
    data: {
      productId: product.id,
      customerName,
      rating,
      title,
      body,
      verifiedPurchase,
      status: "pending",
    },
  });

  return { submitted: true };
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

  const [selectedColor, setSelectedColor] = useState(() =>
    resolveInitialColor(colors, initialColor)
  );
  const sizesForColor = useMemo(
    () => product.variants.filter((v) => v.colorName === selectedColor),
    [product.variants, selectedColor]
  );
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedLength, setSelectedLength] = useState<(typeof CATALOG_LENGTHS)[number]>(
    "Straight"
  );
  const [quantity, setQuantity] = useState(1);
  const [chartOpen, setChartOpen] = useState(false);
  const [infoTab, setInfoTab] = useState<"details" | "fit" | "fabric">("details");

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
    setSelectedSize("");
    setQuantity(1);
  }, [selectedColor]);

  const inStock = selectedVariant ? selectedVariant.inventoryQty > 0 : true;
  const maxQty = Math.max(1, selectedVariant?.inventoryQty ?? 9);
  const displayPrice = selectedVariant?.price ?? product.basePrice;
  const lengthGuide = product.lengthGuide || DEFAULT_LENGTH_GUIDE;
  const canAdd = Boolean(selectedVariant && inStock);
  const fitLine =
    product.fitSummary?.split("\n")[0] || "Classic fit. Runs true to size.";
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

  const addLabel = !selectedSize
    ? "Select a size"
    : !inStock
      ? "Out of stock"
      : `${formatCurrency(displayPrice)} · Add to bag`;

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
        <div className="mx-auto max-w-350 px-4 pb-28 pt-4 sm:px-6 lg:px-10 lg:pb-20 lg:pt-6">
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
            <div className="lg:sticky lg:top-28 lg:h-[calc(100svh-8rem)]">
              <div
                className={cn(
                  "grid h-full grid-cols-1 gap-3",
                  images.length > 1 && "lg:grid-cols-[4.25rem_minmax(0,1fr)]"
                )}
              >
                {images.length > 1 && (
                  <div className="hidden h-full flex-col gap-2 overflow-y-auto lg:flex">
                    {images.map((img, i) => (
                      <button
                        key={img.publicId + i}
                        type="button"
                        onClick={() => setActiveImage(i)}
                        className={cn(
                          "aspect-3/4 overflow-hidden border",
                          activeImage === i ? "border-charcoal" : "border-transparent"
                        )}
                      >
                        <img
                          src={imageSrc(img.publicId, 160)}
                          alt=""
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative min-h-0 bg-[#f6f6f4] lg:h-full">
                  <div className="aspect-3/4 lg:aspect-auto lg:h-full">
                    {images[activeImage] ? (
                      <img
                        src={imageSrc(images[activeImage].publicId, 1200)}
                        alt={images[activeImage].altText || product.name}
                        className="h-full w-full object-contain object-center"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#f6f6f4]" />
                    )}
                  </div>
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal shadow-sm"
                        onClick={() =>
                          setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1))
                        }
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal shadow-sm"
                        onClick={() =>
                          setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1))
                        }
                        aria-label="Next image"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
                  {images.map((img, i) => (
                    <button
                      key={img.publicId + i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        "h-16 w-12 shrink-0 overflow-hidden border",
                        activeImage === i ? "border-charcoal" : "border-charcoal/10"
                      )}
                    >
                      <img
                        src={imageSrc(img.publicId, 120)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-charcoal">
                {product.name}
              </h1>

              <a href="#reviews" className="mt-3 flex items-center gap-2">
                <span className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={
                        avgRating != null && i < Math.round(avgRating)
                          ? "fill-charcoal text-charcoal"
                          : "text-charcoal/20"
                      }
                    />
                  ))}
                </span>
                <span className="text-[13px] text-charcoal/55">
                  {avgRating != null
                    ? `${avgRating.toFixed(1)} (${reviews.length} review${reviews.length === 1 ? "" : "s"})`
                    : "Write a review"}
                </span>
              </a>

              <p className="mt-4 text-lg font-medium text-charcoal">
                {formatCurrency(displayPrice)}
                {product.compareAtPrice != null && product.compareAtPrice > displayPrice && (
                  <span className="ml-2 text-base font-normal text-charcoal/35 line-through">
                    {formatCurrency(product.compareAtPrice)}
                  </span>
                )}
              </p>

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
                        selectedColor === color.colorName && "ring-1 ring-charcoal ring-offset-2"
                      )}
                      style={{ backgroundColor: color.colorHex }}
                      title={color.colorName}
                      aria-label={color.colorName}
                      aria-pressed={selectedColor === color.colorName}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="text-[13px] text-charcoal">
                    {selectedSize ? `Size: ${selectedSize}` : "Select a size"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setChartOpen(true)}
                    className="text-[13px] text-charcoal underline underline-offset-4"
                  >
                    Size chart
                  </button>
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
                        variant.inventoryQty <= 0 && "cursor-not-allowed line-through opacity-35"
                      )}
                    >
                      {variant.size}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-charcoal/55">{fitLine}</p>
              </div>

              {product.offerLengths && (
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
                  className={cn(
                    "h-14 flex-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-white",
                    canAdd ? "bg-charcoal hover:bg-charcoal/90" : "bg-[#6f2f3a]"
                  )}
                >
                  {addLabel}
                </button>
              </div>
              <p className="mt-3 text-center text-[12px] text-charcoal/45">
                Duties and taxes applied at checkout
              </p>

              {related[0] && (
                <section className="mt-14 border-t border-charcoal/10 pt-10">
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
                        className="mt-5 flex h-12 items-center justify-center border border-charcoal text-[13px] font-semibold uppercase tracking-[0.14em]"
                      >
                        Shop this style
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              <section className="mt-14">
                <div
                  className="flex rounded-full bg-[#efeee9] p-1"
                  role="tablist"
                  aria-label="Product information"
                >
                  {(["details", "fit", "fabric"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={infoTab === tab}
                      onClick={() => setInfoTab(tab)}
                      className={cn(
                        "h-11 flex-1 rounded-full text-[13px] capitalize",
                        infoTab === tab
                          ? "bg-white font-medium text-charcoal shadow-sm"
                          : "text-charcoal/50"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="px-1 py-8 text-[15px] leading-7 text-charcoal/80">
                  {infoTab === "details" && (
                    <div className="space-y-4">
                      <p>{detailLines[0] || product.shortDescription}</p>
                      {detailLines.length > 1 && (
                        <ul className="list-disc space-y-1 pl-5">
                          {detailLines.slice(1, 8).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {infoTab === "fit" && (
                    <div className="space-y-3">
                      <p className="whitespace-pre-line">
                        {product.fitSummary ||
                          "Classic fit. Runs true to size. If you are between sizes, size up."}
                      </p>
                      <p>{lengthGuide}</p>
                      <button
                        type="button"
                        onClick={() => setChartOpen(true)}
                        className="underline underline-offset-4"
                      >
                        Size chart
                      </button>
                    </div>
                  )}
                  {infoTab === "fabric" && (
                    <div className="space-y-3">
                      {product.fabricType ? (
                        <>
                          <p className="font-medium text-charcoal">{product.fabricType.name}</p>
                          {product.fabricType.description && <p>{product.fabricType.description}</p>}
                        </>
                      ) : (
                        <p>Fabric details coming soon.</p>
                      )}
                      {product.careInstructions && (
                        <p className="whitespace-pre-line">{product.careInstructions}</p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {related[1] && (
            <section className="mt-8 border-t border-charcoal/10 pt-12">
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

          <section id="reviews" className="mt-20 scroll-mt-24 border-t border-charcoal/10 pt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-charcoal">
              Reviews
            </h2>
            <p className="mt-2 text-sm text-charcoal/50">
              {avgRating != null
                ? `${avgRating.toFixed(1)} average from ${reviews.length} review${reviews.length === 1 ? "" : "s"}`
                : "Be the first to review this style."}
            </p>

            {reviews.length > 0 && (
              <div className="mt-8 grid gap-px bg-charcoal/10 md:grid-cols-2">
                {reviews.map((review) => (
                  <article key={review.id} className="bg-white p-6">
                    <div className="mb-2 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          className={
                            i < review.rating
                              ? "fill-charcoal text-charcoal"
                              : "text-charcoal/20"
                          }
                        />
                      ))}
                    </div>
                    {review.title && (
                      <h3 className="text-[15px] font-medium text-charcoal">{review.title}</h3>
                    )}
                    <p className="mt-2 text-sm leading-6 text-charcoal/75">{review.body}</p>
                    <p className="mt-4 text-[12px] text-charcoal/45">
                      {review.customerName}
                      {review.verifiedPurchase && " · Verified purchase"}
                    </p>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-10 max-w-xl">
              <h3 className="mb-4 text-lg font-medium text-charcoal">Write a review</h3>
              <ReviewForm
                defaultName={reviewer.name}
                isSignedIn={reviewer.isSignedIn}
                verifiedPurchase={reviewer.verifiedPurchase}
                submitted={actionData?.submitted}
                error={actionData?.error}
              />
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(17,26,34,0.06)] lg:hidden">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAdd}
          className={cn(
            "flex h-13 w-full items-center justify-center text-[13px] font-semibold uppercase tracking-[0.16em] text-white",
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
