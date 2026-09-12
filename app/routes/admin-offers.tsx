import { Form, redirect } from "react-router";
import type { Route } from "./+types/admin-offers";
import { Badge, Card } from "~/components/ui/Badge";
import { Button } from "~/components/ui/Button";
import { Input, Textarea } from "~/components/ui/Input";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }
  await requireAdmin(request);
  const offers = await db.monthlyOffer.findMany({ orderBy: { startsAt: "desc" } });
  return {
    dbAvailable: true as const,
    offers: offers.map((offer) => ({
      ...offer,
      startsAt: offer.startsAt.toISOString(),
      endsAt: offer.endsAt.toISOString(),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create");

  if (intent === "delete") {
    await db.monthlyOffer.delete({ where: { id: String(formData.get("id") ?? "") } });
    return redirect("/admin/offers");
  }

  if (intent === "toggle") {
    const id = String(formData.get("id") ?? "");
    const offer = await db.monthlyOffer.findUnique({ where: { id } });
    if (offer) {
      await db.monthlyOffer.update({
        where: { id },
        data: { isActive: !offer.isActive },
      });
    }
    return redirect("/admin/offers");
  }

  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const ctaLabel = String(formData.get("ctaLabel") ?? "Shop now").trim() || "Shop now";
  const ctaHref = String(formData.get("ctaHref") ?? "/shop").trim() || "/shop";
  const discountCode = String(formData.get("discountCode") ?? "").trim().toUpperCase() || null;
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  const endsAt = new Date(String(formData.get("endsAt") ?? ""));

  if (!title || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: "Title, start date, and end date are required." };
  }

  await db.monthlyOffer.create({
    data: { title, subtitle, ctaLabel, ctaHref, discountCode, startsAt, endsAt },
  });
  return redirect("/admin/offers");
}

export default function AdminOffers({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-navy">Monthly offers</h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Live campaigns show as a banner on the storefront. Attach a discount code to
          promote it in the cart.
        </p>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionData.error}</div>
      )}

      <Card>
        <h2 className="mb-4 font-medium text-navy">Create offer</h2>
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="create" />
          <Input label="Title" name="title" required placeholder="April shift drop" />
          <Input label="Discount code" name="discountCode" placeholder="APRIL15" />
          <Textarea
            label="Subtitle"
            name="subtitle"
            rows={2}
            className="min-h-20 sm:col-span-2"
          />
          <Input label="Button label" name="ctaLabel" defaultValue="Shop the offer" />
          <Input label="Button link" name="ctaHref" defaultValue="/shop" />
          <Input label="Starts" name="startsAt" type="date" required />
          <Input label="Ends" name="endsAt" type="date" required />
          <div className="sm:col-span-2">
            <Button type="submit">Create offer</Button>
          </div>
        </Form>
      </Card>

      <div className="space-y-4">
        {loaderData.offers.length === 0 ? (
          <p className="text-charcoal/60">No monthly offers yet.</p>
        ) : (
          loaderData.offers.map((offer) => {
            const live =
              offer.isActive &&
              new Date(offer.startsAt).getTime() <= now &&
              new Date(offer.endsAt).getTime() >= now;
            return (
              <Card key={offer.id} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-navy">{offer.title}</p>
                    {offer.subtitle && (
                      <p className="text-sm text-charcoal/70">{offer.subtitle}</p>
                    )}
                    <p className="mt-1 text-xs text-charcoal/50">
                      {toDateInput(new Date(offer.startsAt))} – {toDateInput(new Date(offer.endsAt))}
                      {offer.discountCode ? ` · ${offer.discountCode}` : ""}
                    </p>
                  </div>
                  <Badge variant={live ? "success" : offer.isActive ? "warning" : "default"}>
                    {live ? "Live" : offer.isActive ? "Scheduled" : "Off"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="id" value={offer.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Toggle
                    </Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={offer.id} />
                    <Button type="submit" size="sm" variant="outline" className="text-red-600">
                      Delete
                    </Button>
                  </Form>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
