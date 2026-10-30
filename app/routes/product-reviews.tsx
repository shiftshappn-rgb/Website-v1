import { Link, useActionData } from "react-router";
import type { Route } from "./+types/product-reviews";
import { data } from "react-router";
import { ReviewCard } from "~/components/storefront/ReviewCard";
import { ReviewForm } from "~/components/storefront/ReviewForm";
import { StarRating } from "~/components/storefront/StarRating";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { averageRatingLabel, serializeReview } from "~/lib/reviews";
import { submitProductReview } from "~/lib/review-submit.server";
import { getCustomer } from "~/lib/session.server";
import { buildMeta } from "~/lib/seo";

const PAGE_SIZE = 10;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.product) {
    return [{ title: "Reviews not found — shiftshappn" }];
  }
  return buildMeta({
    title: `Reviews — ${loaderData.product.name} — shiftshappn`,
    description: `Customer reviews for ${loaderData.product.name}.`,
    path: `/products/${loaderData.product.slug}/reviews`,
  });
}

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) throw data("Not found", { status: 404 });
  const db = tryDb();
  if (!db) throw data("Not found", { status: 404 });

  const product = await db.product.findUnique({
    where: { slug: params.slug, status: "active" },
    select: { id: true, slug: true, name: true },
  });
  if (!product) throw data("Not found", { status: 404 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const [totalCount, avgAgg, reviewRows, customer] = await Promise.all([
    db.review.count({ where: { productId: product.id, status: "approved" } }),
    db.review.aggregate({
      where: { productId: product.id, status: "approved" },
      _avg: { rating: true },
    }),
    db.review.findMany({
      where: { productId: product.id, status: "approved" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    getCustomer(request),
  ]);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return {
    product,
    reviews: reviewRows.map(serializeReview),
    avgRating: avgAgg._avg.rating,
    totalCount,
    page,
    totalPages,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
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

  const product = await db.product.findUnique({
    where: { slug: params.slug, status: "active" },
    select: { id: true },
  });
  if (!product) {
    return { error: "Product not found." };
  }

  return submitProductReview({ db, request, productId: product.id });
}

export default function ProductReviewsPage({ loaderData }: Route.ComponentProps) {
  const {
    product,
    reviews,
    avgRating,
    totalCount,
    page,
    totalPages,
    cloudName,
    reviewer,
  } = loaderData;
  const actionData = useActionData<typeof action>();
  const average = avgRating ?? 0;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-350 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <nav className="mb-6 text-[13px] text-charcoal/45">
          <Link to="/shop" className="hover:text-charcoal">
            Shop
          </Link>
          <span className="px-1.5">/</span>
          <Link to={`/products/${product.slug}`} className="hover:text-charcoal">
            {product.name}
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-charcoal/70">Reviews</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-charcoal">
              The Reviews Are In
            </h1>
            <p className="mt-2 text-sm text-charcoal/55">{product.name}</p>
          </div>
          <Link
            to={`/products/${product.slug}`}
            className="inline-flex h-11 items-center border border-charcoal px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-charcoal transition-colors hover:bg-charcoal hover:text-white"
          >
            Back to product
          </Link>
        </div>

        {totalCount > 0 ? (
          <div className="mt-8">
            <p className="text-3xl font-semibold tracking-tight text-charcoal">
              {averageRatingLabel(average)}
              <span className="text-xl font-normal text-charcoal/45"> / 5</span>
            </p>
            <StarRating value={average} size={18} className="mt-2" />
            <p className="mt-2 text-[13px] text-charcoal/50">
              {`Based on ${totalCount.toLocaleString("en-CA")} review${totalCount === 1 ? "" : "s"}`}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-charcoal/55">
            Be the first to review {product.name}.
          </p>
        )}

        {reviews.length > 0 && (
          <div className="mt-10 space-y-4 border-t border-charcoal/10 pt-8">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} cloudName={cloudName} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Link
                to={`?page=${page - 1}`}
                className="text-sm font-medium text-navy underline underline-offset-4"
              >
                Previous
              </Link>
            ) : (
              <span className="text-sm text-charcoal/30">Previous</span>
            )}
            <span className="text-sm text-charcoal/55">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                to={`?page=${page + 1}`}
                className="text-sm font-medium text-navy underline underline-offset-4"
              >
                Next
              </Link>
            ) : (
              <span className="text-sm text-charcoal/30">Next</span>
            )}
          </div>
        )}

        <div className="mt-14 max-w-xl border-t border-charcoal/10 pt-10">
          <h2 className="mb-4 text-lg font-medium text-charcoal">Write a review</h2>
          <ReviewForm
            defaultName={reviewer.name}
            isSignedIn={reviewer.isSignedIn}
            verifiedPurchase={reviewer.verifiedPurchase}
            submitted={actionData?.submitted}
            error={actionData?.error}
          />
        </div>
      </div>
    </div>
  );
}
