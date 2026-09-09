import { Form, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-reviews";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { ReviewStatus } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const reviews = await db.review.findMany({
    include: { product: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  return {
    dbAvailable: true as const,
    reviews: reviews.map((r) => ({
      id: r.id,
      productName: r.product.name,
      productSlug: r.product.slug,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
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
  const status = String(formData.get("status") ?? "") as ReviewStatus;

  if (!id || !["approved", "rejected", "pending"].includes(status)) {
    return { error: "Invalid review action." };
  }

  await db.review.update({
    where: { id },
    data: { status },
  });

  return redirect("/admin/reviews");
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

  const { reviews } = loaderData;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-navy">Reviews</h1>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-charcoal/60">No reviews yet.</p>
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
                    {review.productName} · {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={statusVariant[review.status]}>{review.status}</Badge>
              </div>

              {review.title && (
                <p className="font-medium text-charcoal">{review.title}</p>
              )}
              <p className="text-sm text-charcoal/80">{review.body}</p>

              {review.status === "pending" && (
                <div className="flex gap-2 border-t border-charcoal/10 pt-3">
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
                </div>
              )}

              {review.status !== "pending" && (
                <Form method="post">
                  <input type="hidden" name="id" value={review.id} />
                  <input type="hidden" name="status" value="pending" />
                  <Button type="submit" size="sm" variant="ghost">
                    Reset to Pending
                  </Button>
                </Form>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
