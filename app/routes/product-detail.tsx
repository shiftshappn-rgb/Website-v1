import { useMemo, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import type { Route } from "./+types/product-detail";
import { Link, data } from "react-router";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { useCart } from "~/lib/cart";
import { getProductColors } from "~/lib/serialize";
import { serializeProduct } from "~/lib/serialize.server";
import {
  buildMeta,
  JsonLd,
  productJsonLd,
  breadcrumbJsonLd,
} from "~/lib/seo";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import {
  cn,
  formatCurrency,
  getVariantLabel,
} from "~/lib/utils";
import { Button } from "~/components/ui/Button";

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

export async function loader({ params }: Route.LoaderArgs) {
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

  return {
    product: serialized,
    reviews: product.reviews,
    avgRating,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-charcoal/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <span className="font-medium text-charcoal">{title}</span>
        <ChevronDown
          size={18}
          className={cn("text-charcoal/50 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="pb-4 text-sm text-charcoal/80">{children}</div>}
    </div>
  );
}

export default function ProductDetail({ loaderData }: Route.ComponentProps) {
  const { product, reviews, avgRating, cloudName } = loaderData;
  const addItem = useCart((s) => s.addItem);
  const colors = getProductColors(product);

  const [selectedColor, setSelectedColor] = useState(colors[0]?.colorName ?? "");
  const sizesForColor = useMemo(
    () => product.variants.filter((v) => v.colorName === selectedColor),
    [product.variants, selectedColor]
  );
  const [selectedSize, setSelectedSize] = useState(sizesForColor[0]?.size ?? "");

  const selectedVariant = product.variants.find(
    (v) => v.colorName === selectedColor && v.size === selectedSize
  );

  const images = selectedVariant?.images.length
    ? selectedVariant.images
    : product.variants.flatMap((v) => v.images).slice(0, 6);

  const [activeImage, setActiveImage] = useState(0);

  const inStock = (selectedVariant?.inventoryQty ?? 0) > 0;
  const displayPrice = selectedVariant?.price ?? product.basePrice;

  function handleAddToCart() {
    if (!selectedVariant) return;
    const image = selectedVariant.images[0];
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      variantLabel: getVariantLabel(selectedVariant.colorName, selectedVariant.size),
      colorHex: selectedVariant.colorHex,
      price: selectedVariant.price,
      imagePublicId: image?.publicId,
      imageAlt: image?.altText,
    });
  }

  const cloud = cloudName ?? "demo";

  return (
    <>
      <JsonLd
        data={productJsonLd({
          name: product.name,
          description: product.shortDescription ?? product.description,
          slug: product.slug,
          price: displayPrice,
          inStock,
          image: images[0]
            ? `https://res.cloudinary.com/${cloud}/image/upload/${images[0].publicId}`
            : undefined,
          rating: avgRating ?? undefined,
          reviewCount: reviews.length || undefined,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          ...(product.category
            ? [{ name: product.category.name, path: `/shop/${product.category.slug}` }]
            : []),
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div>
            <div className="aspect-[3/4] bg-stone rounded-xl overflow-hidden mb-4">
              {images[activeImage] ? (
                <img
                  src={`https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_800/${images[activeImage].publicId}`}
                  alt={images[activeImage].altText}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-stone" />
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2",
                      activeImage === i ? "border-navy" : "border-transparent"
                    )}
                  >
                    <img
                      src={`https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_120/${img.publicId}`}
                      alt={img.altText}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            {product.category && (
              <p className="kicker mb-2">{product.category.name}</p>
            )}
            <h1 className="text-3xl lg:text-4xl font-serif text-navy">{product.name}</h1>

            {avgRating != null && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < Math.round(avgRating) ? "fill-terracotta text-terracotta" : "text-charcoal/20"}
                    />
                  ))}
                </div>
                <span className="text-sm text-charcoal/60">
                  {avgRating.toFixed(1)} ({reviews.length} reviews)
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <span className="text-2xl font-medium text-navy">
                {formatCurrency(displayPrice)}
              </span>
              {product.compareAtPrice != null && product.compareAtPrice > displayPrice && (
                <span className="text-lg text-charcoal/40 line-through">
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
            </div>

            {product.shortDescription && (
              <p className="mt-4 text-charcoal/80">{product.shortDescription}</p>
            )}

            <div className="mt-8 space-y-6">
              <div>
                <p className="text-sm font-medium text-charcoal mb-3">Colour — {selectedColor}</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.colorName}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color.colorName);
                        const firstSize = product.variants.find(
                          (v) => v.colorName === color.colorName
                        )?.size;
                        if (firstSize) setSelectedSize(firstSize);
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full border-2 transition-transform hover:scale-105",
                        selectedColor === color.colorName
                          ? "border-navy ring-2 ring-navy/20"
                          : "border-charcoal/15"
                      )}
                      style={{ backgroundColor: color.colorHex }}
                      title={color.colorName}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-charcoal">Size</p>
                  <Link
                    to="/size-chart"
                    className="text-sm font-medium text-navy hover:text-terracotta transition-colors"
                  >
                    Size guide
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizesForColor.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={variant.inventoryQty <= 0}
                      onClick={() => setSelectedSize(variant.size)}
                      className={cn(
                        "min-w-[3rem] px-3 py-2 rounded-lg border text-sm transition-colors",
                        selectedSize === variant.size
                          ? "border-navy bg-navy text-white"
                          : "border-charcoal/20 hover:border-navy",
                        variant.inventoryQty <= 0 && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {variant.size}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="terracotta"
                size="lg"
                className="w-full"
                disabled={!inStock || !selectedVariant}
                onClick={handleAddToCart}
              >
                {inStock ? "Add to cart" : "Out of stock"}
              </Button>
              <p className="text-xs text-charcoal/60 leading-relaxed">
                Free shipping over $100 CAD. Free 14-day returns on unworn items
                with tags attached.
              </p>
            </div>

            <div className="mt-10">
              <AccordionSection title="Description" defaultOpen>
                <p className="whitespace-pre-line">{product.description}</p>
              </AccordionSection>
              {product.fabricType && (
                <AccordionSection title="Fabric">
                  <p className="font-medium">{product.fabricType.name}</p>
                  {product.fabricType.description && (
                    <p className="mt-2">{product.fabricType.description}</p>
                  )}
                </AccordionSection>
              )}
              <AccordionSection title="Shipping & returns">
                <p>
                  Free shipping on orders over $100 CAD. Free 14-day returns on unworn items
                  with tags attached.
                </p>
              </AccordionSection>
            </div>
          </div>
        </div>

        {reviews.length > 0 && (
          <section className="mt-16 lg:mt-24">
            <h2 className="text-2xl font-serif text-navy mb-8">Customer reviews</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  className="p-6 bg-white rounded-xl border border-charcoal/10"
                >
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < review.rating ? "fill-terracotta text-terracotta" : "text-charcoal/20"}
                      />
                    ))}
                  </div>
                  {review.title && (
                    <h3 className="font-medium text-charcoal">{review.title}</h3>
                  )}
                  <p className="mt-2 text-sm text-charcoal/80">{review.body}</p>
                  <p className="mt-3 text-xs text-charcoal/50">
                    {review.customerName}
                    {review.verifiedPurchase && " · Verified purchase"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
