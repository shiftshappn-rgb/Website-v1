import { Form, Link, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/admin-reviews";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { parseReviewPhotos } from "~/lib/reviews";
import { requireAdmin } from "~/lib/session.server";
import { cn } from "~/lib/utils";
import type { ReviewStatus } from "@prisma/client";

const STATUSES = ["all", "pending", "approved", "rejected"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const status = new URL(request.url).searchParams.get("status");
  const reviews = await db.review.findMany({
    where:
      status && status !== "all" && ["pending", "approved", "rejected"].includes(status)
        ? { status: status as ReviewStatus }
        : undefined,
    include: { product: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    db.review.count({ where: { status: "pending" } }),
    db.review.count({ where: { status: "approved" } }),
    db.review.count({ where: { status: "rejected" } }),
  ]);

  return {
    dbAvailable: true as const,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
    counts: {
      all: pendingCount + approvedCount + rejectedCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      productName: r.product.name,
      productSlug: r.product.slug,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      photos: parseReviewPhotos(r.photos),
      verifiedPurchase: r.verifiedPurchase,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "update-status");

  if (!id) {
    return { error: "Invalid review action." };
  }

  if (intent === "delete") {
    await db.review.delete({ where: { id } });
    return redirect(request.headers.get("Referer") ?? "/admin/reviews");
  }

  const status = String(formData.get("status") ?? "") as ReviewStatus;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return { error: "Invalid review action." };
  }

  await db.review.update({
    where: { id },
    data: { status },
  });

  return redirect(request.headers.get("Referer") ?? "/admin/reviews");
}

const statusVariant: Record<ReviewStatus, "default" | "success" | "warning" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export default function AdminReviews({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { reviews, counts, cloudName } = loaderData;
  const [params] = useSearchParams();
  const active = params.get("status") ?? "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Reviews</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          New storefront reviews land here as pending. Approve to publish them on the
          product page.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <Link
            key={status}
            to={status === "all" ? "/admin/reviews" : `/admin/reviews?status=${status}`}
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

              <div className="flex flex-wrap gap-2 border-t border-charcoal/10 pt-3">
                {review.status === "pending" && (
                  <>
                    <Form method="post">
                      <input type="hidden" name="id" value={review.id} />
                      <input type="hidden" name="status" value="approved" />
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="id" value={review.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <Button type="submit" size="sm" variant="outline" className="text-red-600">
                        Reject
                      </Button>
                    </Form>
                  </>
                )}
                {review.status !== "pending" && (
                  <Form method="post">
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="pending" />
                    <Button type="submit" size="sm" variant="ghost">
                      Reset to pending
                    </Button>
                  </Form>
                )}
                <Form
                  method="post"
                  onSubmit={(event) => {
                    if (!confirm("Delete this review? This cannot be undone.")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={review.id} />
                  <input type="hidden" name="intent" value="delete" />
                  <Button type="submit" size="sm" variant="ghost" className="text-red-700">
                    Delete
                  </Button>
                </Form>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
