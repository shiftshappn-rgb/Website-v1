import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/admin-delivery-locations";
import { Button } from "~/components/ui/Button";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { LocationType } from "@prisma/client";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const locations = await db.deliveryLocation.findMany({
    include: {
      timeSlots: { orderBy: { startTime: "asc" } },
      _count: { select: { orders: true } },
    },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return {
    dbAvailable: true as const,
    locations,
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) {
      return { error: "Location ID required." };
    }

    const location = await db.deliveryLocation.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!location) {
      return { error: "Location not found." };
    }

    if (location._count.orders > 0) {
      return {
        error: `Cannot delete "${location.name}" — it has ${location._count.orders} order(s) associated.`,
      };
    }

    await db.deliveryLocation.delete({ where: { id } });
    return { success: `Deleted "${location.name}".` };
  }

  if (intent === "reorder") {
    const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
    await Promise.all(
      ids.map((id, index) =>
        db.deliveryLocation.update({ where: { id }, data: { sortOrder: index } })
      )
    );
    return { success: "Order updated." };
  }

  return { error: "Unknown action." };
}

export default function AdminDeliveryLocations({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { locations } = loaderData;

  const typeIcons: Record<LocationType, string> = {
    hospital: "🏥",
    clinic: "🏥",
    other: "📦",
  };

  const typeLabels: Record<LocationType, string> = {
    hospital: "Hospital",
    clinic: "Clinic",
    other: "Other",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin</p>
          <h1 className="mt-1 font-serif text-2xl text-navy">Delivery Locations</h1>
          <p className="mt-1 text-sm text-charcoal/60">
            Manage hospital, clinic, and custom delivery locations with time slots
          </p>
        </div>
        <Link to="/admin/delivery-locations/new" className="inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-navy text-white font-medium hover:bg-navy/90 transition-colors">
          + Add Location
        </Link>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {actionData.success}
        </div>
      )}

      <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand/50 text-left text-xs uppercase tracking-wide text-charcoal/50">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">City</th>
              <th className="px-4 py-3 font-medium">Free Delivery</th>
              <th className="px-4 py-3 font-medium">Time Slots</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-charcoal/60">
                  No delivery locations yet. Create your first location.
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location.id} className="border-t border-charcoal/5 hover:bg-sand/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-sand/80">
                      {typeIcons[location.type]}
                      {typeLabels[location.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy">{location.name}</div>
                    <div className="text-xs text-charcoal/50 truncate max-w-xs">
                      {location.line1}{location.line2 && `, ${location.line2}`}
                      {", "}{location.city}{", "}{location.province}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal/70 md:table-cell">{location.city}</td>
                  <td className="px-4 py-3">
                    <span className={location.freeDelivery ? "text-green-700" : "text-charcoal/60"}>
                      {location.freeDelivery ? "✓ Free" : "Paid"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-charcoal/70">{location.timeSlots.length}</span>
                    {location.timeSlots.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-navy hover:underline">View</summary>
                        <ul className="mt-1 space-y-0.5 text-xs text-charcoal/60">
                          {location.timeSlots.map((slot) => (
                            <li key={slot.id}>
                              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][slot.dayOfWeek]}:
                              {" "}
                              {slot.label} ({slot.startTime}–{slot.endTime})
                              {slot.maxOrders && ` · max ${slot.maxOrders}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-charcoal/70">{location._count.orders}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/admin/delivery-locations/${location.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-navy hover:bg-sand/50"
                      >
                        Edit
                      </Link>
                      <Form method="post" onSubmit={(e) => confirm("Delete this location?") || e.preventDefault()}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={location.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                          Delete
                        </Button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}