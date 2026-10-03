import { data, useNavigate, useLoaderData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/checkout-shipping";
import { useCheckout } from "~/lib/checkout-context";
import { cn, formatCurrency } from "~/lib/utils";
import { Button } from "~/components/ui/shadcn-button";
import { Input as ShadInput } from "~/components/ui/shadcn-input";
import { Link } from "react-router";
import { tryDb } from "~/db.server";
import { getCustomer } from "~/lib/session.server";
import type { LocationType } from "@prisma/client";

type DeliveryLocationData = {
  id: string;
  name: string;
  type: LocationType;
  freeDelivery: boolean;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  timeSlots: Array<{
    id: string;
    label: string;
    startTime: string;
    endTime: string;
  }>;
};

function formatTimeRange(start: string, end: string) {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function uniqueSlotsByLabel(slots: DeliveryLocationData["timeSlots"]) {
  const byLabel = new Map<string, DeliveryLocationData["timeSlots"][0]>();
  for (const slot of slots) {
    if (!byLabel.has(slot.label)) {
      byLabel.set(slot.label, slot);
    }
  }
  return Array.from(byLabel.values());
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = tryDb();
  const customer = db ? await getCustomer(request) : null;

  const locations = db
    ? await db.deliveryLocation.findMany({
        where: { isActive: true },
        include: {
          timeSlots: {
            where: { isActive: true },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            select: { id: true, label: true, startTime: true, endTime: true },
          },
        },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      })
    : [];

  return {
    locations,
    savedAddresses:
      customer?.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })) ?? [],
    customerName: customer?.name ?? "",
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const deliveryLocationId = String(formData.get("deliveryLocationId") ?? "");
  const deliveryTimeSlotId = String(formData.get("deliveryTimeSlotId") ?? "");
  const shippingMethod = String(formData.get("shippingMethod") ?? "standard") as
    | "hospital_free"
    | "standard"
    | "express";

  const db = tryDb();
  let shippingCost = shippingMethod === "express" ? 15 : 9.95;

  if (db && deliveryLocationId && deliveryLocationId !== "other-custom") {
    const location = await db.deliveryLocation.findUnique({
      where: { id: deliveryLocationId },
    });
    if (location?.freeDelivery) {
      shippingCost = 0;
    }
  }

  return data({
    success: true,
    redirectTo: "/checkout/payment",
    phase2Data: { deliveryLocationId, deliveryTimeSlotId, shippingMethod, shippingCost },
  });
}

function LocationCard({
  location,
  selected,
  onSelect,
}: {
  location: DeliveryLocationData;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-200",
        selected
          ? "border-[#1b2a4a] bg-[#1b2a4a]/[0.04] shadow-sm"
          : "border-[#e5e0d8] bg-white hover:border-[#1b2a4a]/40 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 size-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
            selected ? "border-[#1b2a4a] bg-[#1b2a4a]" : "border-[#ccc] bg-white"
          )}
        >
          {selected && <div className="size-1.5 rounded-full bg-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1b2a4a] leading-snug">{location.name}</p>
          <p className="text-xs text-[#888] mt-0.5">
            {location.line1}
            {location.line2 ? `, ${location.line2}` : ""}
            {location.city ? `, ${location.city}` : ""}
            {location.postalCode ? `, ${location.postalCode}` : ""}
          </p>
          {location.freeDelivery && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
              ✓ Free Delivery
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function CheckoutPhase2() {
  const { locations, savedAddresses, customerName } = useLoaderData<typeof loader>();
  const { updatePhase2, formData, hydrated } = useCheckout();
  const { phase1 } = formData ?? {};
  const navigate = useNavigate();

  const hospitals = locations.filter((l) => l.type === "hospital");
  const clinics = locations.filter((l) => l.type === "clinic");
  const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(
    defaultAddress?.id ?? null
  );

  const [billingName, setBillingName] = useState(customerName);
  const [billingLine1, setBillingLine1] = useState(defaultAddress?.line1 ?? "");
  const [billingLine2, setBillingLine2] = useState(defaultAddress?.line2 ?? "");
  const [billingCity, setBillingCity] = useState(defaultAddress?.city ?? "Halifax");
  const [billingProvince, setBillingProvince] = useState(defaultAddress?.province ?? "NS");
  const [billingPostal, setBillingPostal] = useState(defaultAddress?.postalCode ?? "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const isHospitalOrClinic =
    selectedLocation?.type === "hospital" || selectedLocation?.type === "clinic";
  const isOther = selectedLocationId === "other-custom";
  const availableTimeSlots = selectedLocation
    ? uniqueSlotsByLabel(selectedLocation.timeSlots)
    : [];

  const shippingCost = isHospitalOrClinic
    ? 0
    : shippingMethod === "express"
    ? 15
    : (phase1?.subtotal ?? 0) >= 100
    ? 0
    : 9.95;

  const isGiftCardsOnly = phase1?.hasGiftCards && !phase1?.hasProducts;

  const canContinue = isGiftCardsOnly
    ? true
    : !!selectedLocationId &&
      (isHospitalOrClinic ? !!selectedTimeSlot : true) &&
      (!isOther || (billingLine1 && billingCity && billingPostal));

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSubmitting(true);
    setError(null);

    if (isGiftCardsOnly) {
      updatePhase2({
        deliveryLocationId: "",
        deliveryTimeSlotId: "",
        shippingMethod: "standard",
        shippingCost: 0,
        billingAddress: {
          name: "",
          line1: "",
          line2: "",
          city: "",
          province: "",
          postalCode: "",
          country: "CA",
        },
        deliveryLocationName: "Digital delivery",
        deliveryLocationType: "other",
      });
      navigate("/checkout/payment");
      return;
    }

    const billingAddress = isOther
      ? {
          name: billingName,
          line1: billingLine1,
          line2: billingLine2,
          city: billingCity,
          province: billingProvince,
          postalCode: billingPostal,
          country: "CA",
        }
      : selectedLocation
      ? {
          name: "",
          line1: selectedLocation.line1,
          line2: selectedLocation.line2 ?? "",
          city: selectedLocation.city,
          province: selectedLocation.province,
          postalCode: selectedLocation.postalCode,
          country: "CA",
        }
      : null;

    const selectedSlot = availableTimeSlots.find((s) => s.id === selectedTimeSlot);

    updatePhase2({
      deliveryLocationId: isOther ? "" : selectedLocationId!,
      deliveryTimeSlotId: selectedTimeSlot ?? "",
      shippingMethod: isHospitalOrClinic ? "hospital_free" : shippingMethod,
      shippingCost,
      billingAddress: billingAddress as any,
      deliveryLocationName: isOther ? "Custom Address" : selectedLocation?.name ?? "Custom Address",
      deliveryLocationType: isOther ? "other" : selectedLocation?.type ?? "other",
      deliveryTimeSlotLabel: selectedSlot?.label,
    });

    navigate("/checkout/payment");
  };

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="size-6 animate-spin text-[#1b2a4a]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!phase1) {
    return (
      <div className="text-center py-16">
        <p className="text-[#888] mb-4">Please complete the previous step first.</p>
        <Button asChild className="bg-[#1b2a4a] text-white rounded-full px-8">
          <Link to="/checkout">Go to Cart</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs text-[#888]">
          <Link to="/checkout" className="hover:text-[#1b2a4a] transition-colors">
            Cart &amp; Account
          </Link>
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-[#1b2a4a]">Delivery</span>
        </div>

        {phase1.hasProducts && (
          <>
            {hospitals.length > 0 && (
              <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e5e0d8] flex items-center gap-2">
                  <span className="text-lg">🏥</span>
                  <div>
                    <h3 className="font-semibold text-sm text-[#1b2a4a]">Hospitals</h3>
                    <p className="text-xs text-emerald-600 font-medium">Free delivery</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {hospitals.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      selected={selectedLocationId === loc.id}
                      onSelect={() => {
                        setSelectedLocationId(loc.id);
                        setSelectedTimeSlot(null);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {clinics.length > 0 && (
              <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e5e0d8] flex items-center gap-2">
                  <span className="text-lg">🏛</span>
                  <div>
                    <h3 className="font-semibold text-sm text-[#1b2a4a]">Clinics</h3>
                    <p className="text-xs text-emerald-600 font-medium">Free delivery</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {clinics.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      selected={selectedLocationId === loc.id}
                      onSelect={() => {
                        setSelectedLocationId(loc.id);
                        setSelectedTimeSlot(null);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e5e0d8] flex items-center gap-2">
                <span className="text-lg">📦</span>
                <div>
                  <h3 className="font-semibold text-sm text-[#1b2a4a]">Other Address</h3>
                  <p className="text-xs text-[#888]">Standard or express shipping rates apply</p>
                </div>
              </div>
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocationId("other-custom");
                    setSelectedTimeSlot(null);
                  }}
                  className={cn(
                    "w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all duration-200",
                    selectedLocationId === "other-custom"
                      ? "border-[#1b2a4a] bg-[#1b2a4a]/[0.04]"
                      : "border-[#e5e0d8] bg-white hover:border-[#1b2a4a]/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-4 rounded-full border-2 flex items-center justify-center",
                        selectedLocationId === "other-custom"
                          ? "border-[#1b2a4a] bg-[#1b2a4a]"
                          : "border-[#ccc]"
                      )}
                    >
                      {selectedLocationId === "other-custom" && (
                        <div className="size-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#1b2a4a]">Enter a custom address</span>
                  </div>
                </button>

                {isOther && (
                  <div className="mt-4 space-y-3 border-t border-[#f0ece6] pt-4">
                    {savedAddresses.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-semibold text-[#555] uppercase tracking-wider">
                          Saved addresses
                        </p>
                        <div className="space-y-2">
                          {savedAddresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setSelectedSavedAddressId(addr.id);
                                setBillingLine1(addr.line1);
                                setBillingLine2(addr.line2 ?? "");
                                setBillingCity(addr.city);
                                setBillingProvince(addr.province);
                                setBillingPostal(addr.postalCode);
                              }}
                              className={cn(
                                "w-full text-left rounded-xl border-2 px-4 py-3 transition-all",
                                selectedSavedAddressId === addr.id
                                  ? "border-[#1b2a4a] bg-[#1b2a4a]/4"
                                  : "border-[#e5e0d8] hover:border-[#1b2a4a]/40"
                              )}
                            >
                              <p className="text-sm font-medium text-[#1b2a4a]">
                                {addr.label || "Saved address"}
                                {addr.isDefault && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-700">
                                    Default
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[#888] mt-0.5">
                                {addr.line1}
                                {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.province}{" "}
                                {addr.postalCode}
                              </p>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSelectedSavedAddressId(null)}
                            className={cn(
                              "w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all",
                              selectedSavedAddressId === null
                                ? "border-[#1b2a4a] bg-[#1b2a4a]/4 text-[#1b2a4a]"
                                : "border-[#e5e0d8] text-[#666] hover:border-[#1b2a4a]/40"
                            )}
                          >
                            Enter a new address
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        {
                          id: "standard" as const,
                          label: "Standard",
                          price: (phase1.subtotal ?? 0) >= 100 ? "Free" : "$9.95",
                          eta: "3–5 days",
                        },
                        { id: "express" as const, label: "Express", price: "$15.00", eta: "1–2 days" },
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setShippingMethod(method.id)}
                          className={cn(
                            "rounded-xl border-2 p-3 text-left transition-all",
                            shippingMethod === method.id
                              ? "border-[#1b2a4a] bg-[#1b2a4a]/[0.04]"
                              : "border-[#e5e0d8] hover:border-[#1b2a4a]/40"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className={cn(
                                "size-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                shippingMethod === method.id
                                  ? "border-[#1b2a4a] bg-[#1b2a4a]"
                                  : "border-[#ccc]"
                              )}
                            >
                              {shippingMethod === method.id && (
                                <div className="size-1 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-[#1b2a4a]">{method.label}</span>
                          </div>
                          <p className="text-xs font-bold text-[#1b2a4a] pl-5">{method.price}</p>
                          <p className="text-[10px] text-[#888] pl-5">{method.eta}</p>
                        </button>
                      ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">
                          Full Name *
                        </label>
                        <ShadInput
                          value={billingName}
                          onChange={(e) => setBillingName(e.target.value)}
                          placeholder="Your name"
                          className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">
                          Address Line 1 *
                        </label>
                        <ShadInput
                          value={billingLine1}
                          onChange={(e) => setBillingLine1(e.target.value)}
                          placeholder="123 Main St"
                          className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">
                          Address Line 2
                        </label>
                        <ShadInput
                          value={billingLine2}
                          onChange={(e) => setBillingLine2(e.target.value)}
                          placeholder="Apt, Suite, etc."
                          className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">
                          City *
                        </label>
                        <ShadInput
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                          placeholder="Halifax"
                          className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">
                          Province *
                        </label>
                        <ShadInput
                          value={billingProvince}
                          onChange={(e) => setBillingProvince(e.target.value)}
                          placeholder="NS"
                          className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#555] uppercase tracking-wider mb-1.5">
                          Postal Code *
                        </label>
                        <ShadInput
                          value={billingPostal}
                          onChange={(e) => setBillingPostal(e.target.value)}
                          placeholder="B3H 3A7"
                          className="border-[#d1ccc3] focus-visible:ring-[#1b2a4a] rounded-xl"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {isHospitalOrClinic && availableTimeSlots.length > 0 && (
          <section className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e5e0d8]">
              <h3 className="font-semibold text-sm text-[#1b2a4a]">Choose a Time Slot</h3>
              <p className="text-xs text-[#888] mt-0.5">We&apos;ll deliver to {selectedLocation?.name}</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableTimeSlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedTimeSlot(slot.id)}
                  className={cn(
                    "rounded-xl border-2 p-4 text-center transition-all duration-200",
                    selectedTimeSlot === slot.id
                      ? "border-[#1b2a4a] bg-[#1b2a4a] text-white"
                      : "border-[#e5e0d8] bg-white hover:border-[#1b2a4a]/40 text-[#1b2a4a]"
                  )}
                >
                  <p className="text-xs font-bold">{slot.label}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-0.5",
                      selectedTimeSlot === slot.id ? "text-white/70" : "text-[#888]"
                    )}
                  >
                    {formatTimeRange(slot.startTime, slot.endTime)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {!phase1.hasProducts && phase1.hasGiftCards && (
          <section className="rounded-2xl border border-[#e5e0d8] bg-white px-6 py-5">
            <p className="text-sm text-[#555]">
              Gift cards are delivered digitally — no shipping address needed.
            </p>
          </section>
        )}

        {error && (
          <div
            className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <svg className="size-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-2xl border-[#d1ccc3] text-[#555] hover:bg-[#f0ece6] px-6"
          >
            <Link to="/checkout">
              <svg className="size-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue || isSubmitting}
            className="flex-1 h-14 rounded-2xl bg-[#1b2a4a] hover:bg-[#2a3d6a] text-white text-base font-semibold disabled:opacity-40 transition-all"
          >
            {isSubmitting ? (
              "Processing…"
            ) : (
              <span className="flex items-center justify-between w-full px-2">
                <span>Continue to Payment</span>
                <span className="flex items-center gap-1 opacity-80">
                  {formatCurrency(
                    (phase1.subtotal ?? 0) -
                      (phase1.discountAmount ?? 0) -
                      (phase1.giftCardAmount ?? 0) +
                      shippingCost
                  )}
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24 space-y-4">
        <div className="rounded-2xl border border-[#e5e0d8] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e0d8]">
            <h3 className="font-serif text-sm font-semibold text-[#1b2a4a]">Your Selection</h3>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            <div className="flex justify-between text-[#555]">
              <span>Items</span>
              <span className="font-medium text-[#1b2a4a]">{formatCurrency(phase1.subtotal ?? 0)}</span>
            </div>
            {(phase1.discountAmount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>−{formatCurrency(phase1.discountAmount ?? 0)}</span>
              </div>
            )}
            {(phase1.giftCardAmount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Gift Card</span>
                <span>−{formatCurrency(phase1.giftCardAmount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#555]">
              <span>Shipping</span>
              <span
                className={
                  isHospitalOrClinic || shippingCost === 0
                    ? "text-emerald-600 font-medium"
                    : "font-medium text-[#1b2a4a]"
                }
              >
                {isHospitalOrClinic || shippingCost === 0
                  ? "Free"
                  : shippingMethod === "express"
                  ? "$15.00"
                  : "$9.95"}
              </span>
            </div>
            {selectedLocation && (
              <div className="pt-2 border-t border-[#f0ece6]">
                <p className="text-xs text-[#888]">Delivering to:</p>
                <p className="text-xs font-medium text-[#1b2a4a] mt-0.5">{selectedLocation.name}</p>
                {selectedTimeSlot && (
                  <p className="text-xs text-[#888] mt-0.5">
                    {availableTimeSlots.find((s) => s.id === selectedTimeSlot)?.label} ·{" "}
                    {formatTimeRange(
                      availableTimeSlots.find((s) => s.id === selectedTimeSlot)!.startTime,
                      availableTimeSlots.find((s) => s.id === selectedTimeSlot)!.endTime
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5e0d8] bg-white px-5 py-4 space-y-3">
          {[
            { icon: "🔒", text: "Secure SSL encryption" },
            { icon: "📋", text: "Easy 30-day returns" },
            { icon: "📧", text: "Email confirmation sent instantly" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 text-xs text-[#666]">
              <span className="text-base">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
