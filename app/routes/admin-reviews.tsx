import { Form, Link, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/admin-reviews";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import {
  getSetsForProduct,
  getSharedReviewProductIds,
} from "~/lib/review-products.server";
import { parseReviewPhotos } from "~/lib/reviews";
import { requireAdmin } from "~/lib/session.server";
import { cn } from "~/lib/utils";
import type { ReviewStatus } from "@prisma/client";

const STATUSES = ["all", "pending", "approved", "rejected"] as const;
const PAGE_SIZE = 10;

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const where =
    status && status !== "all" && ["pending", "approved", "rejected"].includes(status)
      ? { status: status as ReviewStatus }
      : undefined;

  const [pendingCount, approvedCount, rejectedCount, filteredCount] = await Promise.all([
    db.review.count({ where: { status: "pending" } }),
    db.review.count({ where: { status: "approved" } }),
    db.review.count({ where: { status: "rejected" } }),
    db.review.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const reviews = await db.review.findMany({
    where,
    include: { product: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const setsByProductId = new Map<string, Array<{ name: string; slug: string }>>();
  await Promise.all(
    reviews.map(async (review) => {
      if (setsByProductId.has(review.product.id)) return;
      setsByProductId.set(review.product.id, await getSetsForProduct(db, review.product.id));
    })
  );

  return {
    dbAvailable: true as const,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
    page: safePage,
    totalPages,
    filteredCount,
    pageSize: PAGE_SIZE,
    counts: {
      all: pendingCount + approvedCount + rejectedCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      productId: r.product.id,
      productName: r.product.name,
      productSlug: r.product.slug,
      sets: setsByProductId.get(r.product.id) ?? [],
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      photos: parseReviewPhotos(r.photos),
      sizePurchased: r.sizePurchased,
      height: r.height,
      lengthPurchased: r.lengthPurchased,
      weight: r.weight,
      occupation: r.occupation,
      fit: r.fit,
      verifiedPurchase: r.verifiedPurchase,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

function safeReviewsReturnTo(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value : "";
  if (raw.startsWith("/admin/reviews")) return raw;
  return "/admin/reviews";
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "update-status");
  const returnTo = safeReviewsReturnTo(formData.get("returnTo"));

  if (!id) {
    return { error: "Invalid review action." };
  }

  const review = await db.review.findUnique({ where: { id } });
  if (!review) {
    return { error: "Review not found." };
  }

  const sharedProductIds = await getSharedReviewProductIds(db, review.productId);
  const mirrorWhere = {
    productId: { in: sharedProductIds },
    customerName: review.customerName,
    rating: review.rating,
    body: review.body,
    title: review.title,
  };

  if (intent === "delete") {
    await db.review.deleteMany({ where: mirrorWhere });
    return redirect(returnTo);
  }

  const status = String(formData.get("status") ?? "") as ReviewStatus;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return { error: "Invalid review action." };
  }

  // Keep mirrored set-piece reviews in the same status.
  await db.review.updateMany({
    where: mirrorWhere,
    data: { status },
  });

  return redirect(returnTo);
}

const statusVariant: Record<ReviewStatus, "default" | "success" | "warning" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

function reviewsHref(status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/reviews?${query}` : "/admin/reviews";
}

export default function AdminReviews({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { reviews, counts, cloudName, page, totalPages, filteredCount, pageSize } = loaderData;
  const [params] = useSearchParams();
  const active = params.get("status") ?? "all";
  const returnTo = reviewsHref(active, page);
  const rangeStart = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filteredCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Reviews</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Storefront reviews are loaded live from the database. New ones land here as
          pending — approve to publish, or delete to remove permanently. Set reviews are
          mirrored to top and pants; approving one updates both.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <Link
            key={status}
            to={reviewsHref(status, 1)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm capitalize",
              active === status
                ? "bg-navy text-white"
                : "border border-charcoal/15 text-charcoal hover:border-navy"
            )}
          >
            {status} ({counts[status]})
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-charcoal/60">No reviews in this filter.</p>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy">{review.customerName}</span>
                    <span className="text-terracotta">{"★".repeat(review.rating)}</span>
                    {review.verifiedPurchase && (
                      <Badge variant="terracotta">Verified</Badge>
                    )}
                  </div>
                  <p className="text-sm text-charcoal/60">
                    <Link
                      to={`/products/${review.productSlug}`}
                      className="hover:text-navy"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {review.productName}
                    </Link>
                    {review.sets.length > 0 ? (
                      <>
                        {" · "}
                        {review.sets.map((set, index) => (
                          <span key={set.slug}>
                            {index > 0 ? ", " : null}
                            <Link
                              to={`/sets/${set.slug}`}
                              className="hover:text-navy"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {set.name} set
                            </Link>
                          </span>
                        ))}
                      </>
                    ) : null}
                    {" · "}
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={statusVariant[review.status]}>{review.status}</Badge>
              </div>

              {review.title && (
                <p className="font-medium text-charcoal">{review.title}</p>
              )}
              <p className="text-sm text-charcoal/80">{review.body}</p>
              {(review.sizePurchased ||
                review.height ||
                review.lengthPurchased ||
                review.weight ||
                review.occupation ||
                review.fit) && (
                <dl className="grid gap-1 rounded-lg bg-sand/60 px-3 py-2 text-xs text-charcoal/70 sm:grid-cols-2">
                  {review.sizePurchased && (
                    <div>
                      <dt className="inline text-charcoal/45">Size: </dt>
                      <dd className="inline font-medium text-charcoal">
                        {review.sizePurchased}
                      </dd>
                    </div>
                  )}
                  {review.lengthPurchased && (
                    <div>
                      <dt className="inline text-charcoal/45">Length: </dt>
                      <dd className="inline font-medium text-charcoal">
                        {review.lengthPurchased}
                      </dd>
                    </div>
                  )}
                  {review.height && (
                    <div>
                      <dt className="inline text-charcoal/45">Height: </dt>
                      <dd className="inline font-medium text-charcoal">{review.height}</dd>
                    </div>
                  )}
                  {review.weight && (
                    <div>
                      <dt className="inline text-charcoal/45">Weight: </dt>
                      <dd className="inline font-medium text-charcoal">{review.weight}</dd>
                    </div>
                  )}
                  {review.occupation && (
                    <div>
                      <dt className="inline text-charcoal/45">Occupation: </dt>
                      <dd className="inline font-medium text-charcoal">
                        {review.occupation}
                      </dd>
                    </div>
                  )}
                  {review.fit && (
                    <div>
                      <dt className="inline text-charcoal/45">Fit: </dt>
                      <dd className="inline font-medium text-charcoal">{review.fit}</dd>
                    </div>
                  )}
                </dl>
              )}
              {review.photos.length > 0 && cloudName && (
                <div className="flex flex-wrap gap-2">
                  {review.photos.map((publicId) => (
                    <img
                      key={publicId}
                      src={`https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_160/${publicId}`}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-charcoal/10 pt-3">
                {review.status === "pending" && (
                  <>
                    <Form method="post">
                      <input type="hidden" name="id" value={review.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="id" value={review.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button type="submit" size="sm" variant="outline" className="text-red-600">
                        Reject
                      </Button>
                    </Form>
                  </>
                )}
                {review.status === "approved" && (
                  <Form method="post">
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="status" value="rejected" />
                    <Button type="submit" size="sm" variant="outline">
                      Unpublish
                    </Button>
                  </Form>
                )}
                {review.status !== "pending" && (
                  <Form method="post">
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="status" value="pending" />
                    <Button type="submit" size="sm" variant="ghost">
                      Reset to pending
                    </Button>
                  </Form>
                )}
                <Form
                  method="post"
                  className="sm:ml-auto"
                  onSubmit={(event) => {
                    if (
                      !confirm(
                        `Delete review by ${review.customerName}? This permanently removes mirrored copies on set pieces too.`
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={review.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="intent" value="delete" />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:border-red-400 hover:bg-red-50"
                  >
                    Delete forever
                  </Button>
                </Form>
              </div>
            </Card>
          ))
        )}
      </div>

      {filteredCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-charcoal/10 pt-4">
          <p className="text-sm text-charcoal/55">
            Showing {rangeStart}–{rangeEnd} of {filteredCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                to={reviewsHref(active, page - 1)}
                className="inline-flex min-h-11 items-center rounded-full border border-charcoal/15 px-4 text-sm text-navy hover:border-navy"
              >
                Previous
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-full border border-charcoal/10 px-4 text-sm text-charcoal/30">
                Previous
              </span>
            )}
            <span className="text-sm tabular-nums text-charcoal/60">
              Page {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                to={reviewsHref(active, page + 1)}
                className="inline-flex min-h-11 items-center rounded-full border border-charcoal/15 px-4 text-sm text-navy hover:border-navy"
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-full border border-charcoal/10 px-4 text-sm text-charcoal/30">
                Next
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
