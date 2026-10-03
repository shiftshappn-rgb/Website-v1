import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/admin-delivery-locations-$id-edit";
import { Button } from "~/components/ui/Button";
import { Input, Select } from "~/components/ui/Input";
import { Checkbox } from "~/components/ui/checkbox";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { LocationType } from "@prisma/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  const location = await db.deliveryLocation.findUnique({
    where: { id: params.id },
    include: { timeSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } },
  });

  if (!location) {
    throw new Response("Location not found", { status: 404 });
  }

  return {
    dbAvailable: true as const,
    location: {
      ...location,
      sortOrder: location.sortOrder,
      timeSlots: location.timeSlots.map((slot) => ({
        ...slot,
        maxOrders: slot.maxOrders ?? null,
      })),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "update-location");

  if (intent === "delete-time-slot") {
    const slotId = String(formData.get("slotId") ?? "").trim();
    if (!slotId) {
      return { error: "Time slot ID required." };
    }
    await db.deliveryTimeSlot.delete({ where: { id: slotId } });
    return { success: "Time slot deleted." };
  }

  if (intent === "add-time-slot") {
    const dayOfWeek = parseInt(String(formData.get("dayOfWeek") ?? "0"), 10);
    const label = String(formData.get("label") ?? "").trim();
    const startTime = String(formData.get("startTime") ?? "").trim();
    const endTime = String(formData.get("endTime") ?? "").trim();
    const maxOrdersRaw = String(formData.get("maxOrders") ?? "").trim();
    const maxOrders = maxOrdersRaw ? parseInt(maxOrdersRaw, 10) : null;
    const isActive = formData.get("isActive") === "on";

    if (!label || !startTime || !endTime) {
      return { error: "Label, start time, and end time are required." };
    }

    await db.deliveryTimeSlot.create({
      data: {
        deliveryLocationId: params.id!,
        dayOfWeek,
        label,
        startTime,
        endTime,
        maxOrders,
        isActive,
      },
    });
    return { success: "Time slot added." };
  }

  if (intent === "reorder-time-slots") {
    const ids = String(formData.get("ids") ?? "").split(",").filter(Boolean);
    await Promise.all(
      ids.map((id, index) =>
        db.deliveryTimeSlot.update({ where: { id }, data: { startTime: String(index) } })
      )
    );
    return { success: "Time slots reordered." };
  }

  // Update location
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "other") as LocationType;
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "Halifax").trim();
  const province = String(formData.get("province") ?? "NS").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const country = String(formData.get("country") ?? "CA").trim();
  const freeDelivery = formData.get("freeDelivery") === "on";
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10);
  const isActive = formData.get("isActive") === "on";

  if (!name || !line1 || !postalCode) {
    return { error: "Name, address line 1, and postal code are required." };
  }

  if (Number.isNaN(sortOrder)) {
    return { error: "Sort order must be a valid number." };
  }

  await db.deliveryLocation.update({
    where: { id: params.id },
    data: {
      name,
      type,
      line1,
      line2,
      city,
      province,
      postalCode,
      country,
      freeDelivery,
      sortOrder,
      isActive,
    },
  });

  return { success: "Location saved." };
}

export default function AdminDeliveryLocationsEdit({ loaderData, actionData }: Route.ComponentProps) {
  if (!loaderData.dbAvailable) {
    return <DatabaseUnavailable />;
  }

  const { location } = loaderData;
  const navigation = useNavigation();
  const saving = navigation.state !== "idle";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm text-charcoal/60">
              <li>
                <Link to="/admin/delivery-locations" className="hover:text-navy">
                  Delivery Locations
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="truncate text-navy">{location.name}</li>
            </ol>
          </nav>
          <h1 className="font-serif text-2xl text-navy">{location.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button form="location-form" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save location"}
          </Button>
        </div>
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

      <Form id="location-form" method="post" className="space-y-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <input type="hidden" name="intent" value="update-location" />

        <fieldset className="space-y-4">
          <legend className="px-2 text-sm font-medium text-navy">Basic Info</legend>

          <Input label="Name *" name="name" defaultValue={location.name} required />

          <Select label="Type *" name="type" defaultValue={location.type}>
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="other">Other</option>
          </Select>

          <div className="flex items-center gap-3">
            <Checkbox name="freeDelivery" defaultChecked={location.freeDelivery} />
            <label className="text-sm text-charcoal">Free delivery</label>
          </div>

          <Input label="Sort Order" name="sortOrder" type="number" min="0" defaultValue={String(location.sortOrder)} />

          <div className="flex items-center gap-3">
            <Checkbox name="isActive" defaultChecked={location.isActive} />
            <label className="text-sm text-charcoal">Active</label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="px-2 text-sm font-medium text-navy">Address</legend>

          <Input label="Line 1 *" name="line1" defaultValue={location.line1} required />
          <Input label="Line 2" name="line2" defaultValue={location.line2 ?? ""} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City *" name="city" defaultValue={location.city} required />
            <Input label="Province *" name="province" defaultValue={location.province} required />
            <Input label="Postal Code *" name="postalCode" defaultValue={location.postalCode} required />
          </div>

          <Input label="Country" name="country" defaultValue={location.country} />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="px-2 text-sm font-medium text-navy">Time Slots</legend>

          {location.timeSlots.length === 0 ? (
            <p className="text-sm text-charcoal/60">No time slots configured. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {location.timeSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-charcoal/10 bg-white p-3"
                >
                  <Select name={`slot-${slot.id}-dayOfWeek`} defaultValue={String(slot.dayOfWeek)} className="w-24">
                    {DAYS.map((day, i) => (
                      <option key={i} value={String(i)}>
                        {day}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name={`slot-${slot.id}-label`}
                    defaultValue={slot.label}
                    placeholder="Label"
                    className="w-32"
                  />
                  <Input
                    name={`slot-${slot.id}-startTime`}
                    type="time"
                    defaultValue={slot.startTime}
                    className="w-28"
                  />
                  <span className="text-charcoal/50">–</span>
                  <Input
                    name={`slot-${slot.id}-endTime`}
                    type="time"
                    defaultValue={slot.endTime}
                    className="w-28"
                  />
                  <Input
                    name={`slot-${slot.id}-maxOrders`}
                    type="number"
                    min="1"
                    defaultValue={slot.maxOrders ? String(slot.maxOrders) : ""}
                    placeholder="Max"
                    className="w-20"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      name={`slot-${slot.id}-isActive`}
                      defaultChecked={slot.isActive}
                    />
                    <span className="text-sm text-charcoal/70">Active</span>
                  </div>
                  <Form method="post" className="ml-auto">
                    <input type="hidden" name="intent" value="delete-time-slot" />
                    <input type="hidden" name="slotId" value={slot.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                      Delete
                    </Button>
                  </Form>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-dashed border-charcoal/20 p-4">
            <h4 className="font-medium text-charcoal mb-3">Add Time Slot</h4>
            <Form method="post" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="intent" value="add-time-slot" />
              <Select name="dayOfWeek" defaultValue="1" className="w-24">
                {DAYS.map((day, i) => (
                  <option key={i} value={String(i)}>
                    {day}
                  </option>
                ))}
              </Select>
              <Input name="label" placeholder="Label (e.g., Morning)" className="w-32" required />
              <Input name="startTime" type="time" defaultValue="08:00" className="w-28" required />
              <span className="text-charcoal/50">–</span>
              <Input name="endTime" type="time" defaultValue="12:00" className="w-28" required />
              <Input name="maxOrders" type="number" min="1" placeholder="Max orders" className="w-28" />
              <div className="flex items-center gap-2">
                <Checkbox name="isActive" defaultChecked />
                <span className="text-sm text-charcoal/70">Active</span>
              </div>
              <Button type="submit" size="sm">Add</Button>
            </Form>
          </div>
        </fieldset>

        <div className="flex gap-3 pt-4 border-t border-charcoal/10">
          <Link to="/admin/delivery-locations" className="inline-flex items-center justify-center rounded-full border border-navy px-5 py-2.5 text-sm font-medium text-navy hover:bg-navy hover:text-white">
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}