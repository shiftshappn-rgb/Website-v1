import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-delivery-locations-new";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { Checkbox } from "~/components/ui/checkbox";
import { DatabaseUnavailable } from "~/components/admin/DatabaseUnavailable";
import { db, isDatabaseAvailable } from "~/db.server";
import { requireAdmin } from "~/lib/session.server";
import type { LocationType } from "@prisma/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DEFAULT_SLOTS = [
  { dayOfWeek: 1, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 1, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 1, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
  { dayOfWeek: 2, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 2, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 2, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
  { dayOfWeek: 3, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 3, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 3, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
  { dayOfWeek: 4, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 4, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 4, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
  { dayOfWeek: 5, label: "Morning", startTime: "08:00", endTime: "12:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 5, label: "Afternoon", startTime: "12:00", endTime: "16:00", maxOrders: 10, isActive: true },
  { dayOfWeek: 5, label: "Evening", startTime: "16:00", endTime: "20:00", maxOrders: 5, isActive: true },
];

export async function loader({ request }: Route.LoaderArgs) {
  if (!isDatabaseAvailable()) {
    return { dbAvailable: false as const };
  }

  await requireAdmin(request);

  return { dbAvailable: true as const };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isDatabaseAvailable()) {
    return { error: "Database is not configured." };
  }

  await requireAdmin(request);

  const formData = await request.formData();

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

  const timeSlotsJson = String(formData.get("timeSlots") ?? "[]");
  let timeSlots: Array<{
    dayOfWeek: number;
    label: string;
    startTime: string;
    endTime: string;
    maxOrders: number | null;
    isActive: boolean;
  }> = [];

  try {
    timeSlots = JSON.parse(timeSlotsJson);
  } catch {
    timeSlots = [];
  }

  if (!name || !line1 || !postalCode) {
    return { error: "Name, address line 1, and postal code are required." };
  }

  if (Number.isNaN(sortOrder)) {
    return { error: "Sort order must be a valid number." };
  }

  const location = await db.deliveryLocation.create({
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
      timeSlots: {
        create: timeSlots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxOrders: slot.maxOrders ?? null,
          isActive: slot.isActive,
        })),
      },
    },
  });

  return redirect(`/admin/delivery-locations/${location.id}/edit`);
}

export default function AdminDeliveryLocationsNew({ actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-serif text-navy">New Delivery Location</h1>
        <Link to="/admin/delivery-locations" className="text-sm text-navy hover:text-terracotta">
          ← Back to list
        </Link>
      </div>

      {actionData?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-6 rounded-xl border border-charcoal/10 bg-white p-6">
        <fieldset className="space-y-4">
          <legend className="px-2 text-sm font-medium text-navy">Basic Info</legend>

          <Input label="Name *" name="name" required placeholder="Halifax Infirmary - Abbie J Lane Building" />

          <Select label="Type *" name="type" defaultValue="other">
            <option value="hospital">Hospital</option>
            <option value="clinic">Clinic</option>
            <option value="other">Other</option>
          </Select>

          <div className="flex items-center gap-3">
            <Checkbox name="freeDelivery" defaultChecked={true} />
            <label className="text-sm text-charcoal">Free delivery (auto-enabled for hospitals/clinics)</label>
          </div>

          <Input label="Sort Order" name="sortOrder" type="number" min="0" defaultValue="0" />

          <div className="flex items-center gap-3">
            <Checkbox name="isActive" defaultChecked />
            <label className="text-sm text-charcoal">Active</label>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="px-2 text-sm font-medium text-navy">Address</legend>

          <Input label="Line 1 *" name="line1" required placeholder="1796 Summer Street" />
          <Input label="Line 2" name="line2" placeholder="Abbie J Lane Building, Room 101" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="City *" name="city" defaultValue="Halifax" required />
            <Input label="Province *" name="province" defaultValue="NS" required />
            <Input label="Postal Code *" name="postalCode" required placeholder="B3H 3A7" />
          </div>

          <Input label="Country" name="country" defaultValue="CA" />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="px-2 text-sm font-medium text-navy">Time Slots</legend>
          <p className="text-sm text-charcoal/60">
            Configure delivery time windows per day. JSON format will be submitted.
          </p>

          <div className="space-y-3 rounded-lg border border-charcoal/10 p-4">
            {DEFAULT_SLOTS.map((slot, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 bg-white rounded-md border border-charcoal/10 p-3">
                <Select
                  name={`timeSlots[${index}].dayOfWeek`}
                  defaultValue={String(slot.dayOfWeek)}
                  className="w-24"
                >
                  {DAYS.map((day, i) => (
                    <option key={i} value={String(i)}>
                      {day}
                    </option>
                  ))}
                </Select>

                <Input
                  name={`timeSlots[${index}].label`}
                  defaultValue={slot.label}
                  placeholder="Label"
                  className="w-32"
                />
                <Input
                  name={`timeSlots[${index}].startTime`}
                  type="time"
                  defaultValue={slot.startTime}
                  className="w-28"
                />
                <span className="text-charcoal/50">–</span>
                <Input
                  name={`timeSlots[${index}].endTime`}
                  type="time"
                  defaultValue={slot.endTime}
                  className="w-28"
                />
                <Input
                  name={`timeSlots[${index}].maxOrders`}
                  type="number"
                  min="1"
                  defaultValue={String(slot.maxOrders ?? "")}
                  placeholder="Max orders"
                  className="w-28"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    name={`timeSlots[${index}].isActive`}
                    defaultChecked={slot.isActive}
                  />
                  <span className="text-sm text-charcoal/70">Active</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-charcoal/50">
              Note: Time slots are submitted as JSON. Use the edit page after creation for drag-and-drop reordering.
            </p>
          </div>
        </fieldset>

        <div className="flex gap-3 pt-4 border-t border-charcoal/10">
          <Button type="submit">Create Location</Button>
          <Link
            to="/admin/delivery-locations"
            className="inline-flex items-center justify-center rounded-full border border-navy px-5 py-2.5 text-sm font-medium text-navy hover:bg-navy hover:text-white"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}