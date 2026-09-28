# Multi-Phase Healthcare Checkout Flow Design

**Date:** 2026-09-28  
**Project:** ShiftsHappn E-commerce  
**Status:** Approved for Implementation

---

## Overview

Replace the current single-step Stripe redirect checkout with a 3-phase hybrid checkout flow optimized for healthcare delivery (hospitals/clinics with free delivery + time slots, plus standard shipping for other addresses).

**Current Flow:** Cart → `api-checkout.ts` → Stripe Checkout → Success  
**New Flow:** Cart → Phase 1 (Cart Review + Account) → Phase 2 (Delivery Location + Time Slot + Billing) → Phase 3 (Payment + Review) → Success

---

## Architecture

### Route Structure (Hybrid Approach C)

| Route | Phase | Method | Purpose |
|-------|-------|--------|---------|
| `/checkout` | 1 | GET/POST | Cart review, promo/gift card, account choice |
| `/checkout/shipping` | 2 | GET/POST | Delivery location, time slot, billing address |
| `/checkout/payment` | 3 | GET/POST | Payment entry, order review, place order |
| `/checkout/success` | - | GET | Existing confirmation page |

### Shared State: `CheckoutContext`

React Context providing:
- `formData: CheckoutFormData` — all phases combined
- `updateField(key, value)` — granular updates
- `nextPhase()`, `prevPhase()` — navigation
- `submitPhase(phase)` — validation + server action call
- Persistence: `sessionStorage` for refresh resilience

### Data Flow

```
Phase 1 POST → validates cart, promo, gift card, auth
    → stores: accountChoice, email, customerId?, discountAmount, giftCardAmount
    → redirects to /checkout/shipping

Phase 2 POST → validates location, time slot, capacity
    → calculates shipping (0 for hospital/clinic, flat for other)
    → stores: deliveryLocationId, deliveryTimeSlotId, shippingMethod, shippingCost, billingAddress
    → redirects to /checkout/payment

Phase 3 POST → validates all prior data
    → creates Stripe PaymentIntent (amount = totalToCharge)
    → confirms payment client-side
    → creates Order in DB with all details
    → clears cart
    → redirects to /checkout/success?session_id=...
```

---

## Phase 1: Cart Review & Account Choice

### Route: `/checkout`

**Loader:** Returns cart items, subtotal, hasGiftCards, hasProducts. Redirects to `/cart` if empty.

**UI:**
- Stepper: `[1 Cart] → 2 Shipping → 3 Payment`
- Editable cart items (qty, remove, variant display)
- Promo code input + Apply
- Gift card code input + Apply
- Subtotal / Discount / Est. Shipping / Tax summary
- Account choice (radio): Guest / Login / Create Account
- Email required for all; conditional password/name fields
- Continue button → Phase 2

**Action:**
- Validates cart, promo (reuse `resolveDiscountCode`), gift card (reuse `resolveGiftCard`)
- Creates/finds customer by email
- Stores `Phase1Data` in context
- Redirects to `/checkout/shipping`

```ts
type Phase1Data = {
  accountChoice: 'guest' | 'login' | 'register';
  email: string;
  customerId?: string;
  promoCode?: string;
  giftCardCode?: string;
  discountAmount: number;
  giftCardAmount: number;
};
```

---

## Phase 2: Shipping & Billing

### Route: `/checkout/shipping`

**Loader:** Loads active `DeliveryLocation[]` with `DeliveryTimeSlot[]`, admin shipping rates from SiteSetting.

**UI:**
- Stepper: `1 Cart → [2 Shipping] → 3 Payment`
- **Delivery Location Selector** (grouped by type):
  - Hospitals (Free) — 10 predefined Halifax locations
  - Clinics (Free) — admin-managed
  - Other Address (Paid) — manual entry
- **Time Slot Selector** (appears after location pick):
  - Date picker (next 7 days)
  - Admin-configurable slots per location (e.g., Morning 8-12, Afternoon 12-4, Evening 4-8)
  - Shows capacity remaining
- **Billing Address** (hidden "same as delivery" for hospital/clinic)
- **Shipping Method** (only for "Other"): Standard ($9.95, free >$100) / Express ($15)
- Back / Continue buttons

**Action:**
- Validates location active, time slot active + capacity
- Calculates shipping cost
- Stores `Phase2Data` in context
- Redirects to `/checkout/payment`

```ts
type Phase2Data = {
  deliveryLocationId: string;
  deliveryTimeSlotId: string;
  shippingMethod: 'hospital_free' | 'standard' | 'express';
  shippingCost: number;
  billingAddress: AddressInput;
};
```

---

## Phase 3: Payment & Finalization

### Route: `/checkout/payment`

**Loader:** Reads all context, calculates final totals, returns line items + Stripe publishable key.

**UI:**
- Stepper: `1 Cart → 2 Shipping → [3 Payment]`
- Read-only order summary with line items and calculated totals
- **Total to Charge** = subtotal - discount - giftCard + shipping + tax
- Stripe Elements card input + Apple Pay / Google Pay
- "Save payment method" checkbox
- Back / Place Order ($XX.XX) button

**Action:**
1. Validates all prior phase data
2. Creates Stripe PaymentIntent with `amount = totalToCharge * 100`
3. Client confirms via Stripe.js, posts `paymentMethodId`
4. On success: creates Order in DB, clears cart
5. Redirects to `/checkout/success`

**Order Creation:**
```ts
await db.order.create({
  data: {
    orderNumber: generateOrderNumber(),
    customerId: phase1.customerId || null,
    email: phase1.email,
    subtotal: phase1.subtotal,
    shipping: phase2.shippingCost,
    tax: calculatedTax,
    total: finalTotal,
    stripePaymentIntentId: paymentIntent.id,
    status: 'paid',
    shippingAddress: phase2.deliveryLocation || customAddress,
    billingAddress: phase2.billingAddress,
    deliveryLocationId: phase2.deliveryLocationId,
    deliveryTimeSlotId: phase2.deliveryTimeSlotId,
    shippingMethod: phase2.shippingMethod,
    items: { create: lineItems.map(...) },
  }
});
```

---

## Data Model Changes

### New Prisma Models

```prisma
model DeliveryLocation {
  id            String   @id @default(cuid())
  name          String
  type          LocationType @default(other)
  line1         String
  line2         String?
  city          String   @default("Halifax")
  province      String   @default("NS")
  postalCode    String
  country       String   @default("CA")
  freeDelivery  Boolean  @default(false)
  isActive      Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  timeSlots     DeliveryTimeSlot[]
  orders        Order[]
}

model DeliveryTimeSlot {
  id                 String   @id @default(cuid())
  deliveryLocationId String
  dayOfWeek          Int      // 0-6
  startTime          String   // "08:00"
  endTime            String   // "12:00"
  label              String   // "Morning (8am-12pm)"
  maxOrders          Int?
  isActive           Boolean  @default(true)

  deliveryLocation   DeliveryLocation @relation(fields: [deliveryLocationId], references: [id], onDelete: Cascade)

  @@unique([deliveryLocationId, dayOfWeek, startTime])
}

enum LocationType {
  hospital
  clinic
  other
}
```

### Extended Order Model

```prisma
model Order {
  // ... existing fields
  deliveryLocationId   String?
  deliveryTimeSlotId   String?
  shippingMethod       String?
  shippingCost         Decimal     @db.Decimal(10,2) @default(0)

  deliveryLocation     DeliveryLocation? @relation(fields: [deliveryLocationId], references: [id])
  deliveryTimeSlot     DeliveryTimeSlot? @relation(fields: [deliveryTimeSlotId], references: [id])
}
```

### Admin Settings (SiteSetting JSON)

```json
{
  "shippingRates": {
    "standard": 9.95,
    "express": 15.00,
    "freeThreshold": 100
  }
}
```

---

## Admin Panel: Delivery Location Management

### Routes
- `/admin/delivery-locations` — List + Create
- `/admin/delivery-locations/new` — Create form
- `/admin/delivery-locations/:id/edit` — Edit form

### List Page Columns
Type | Name | City | Free Delivery | Time Slots | Actions

### Create/Edit Form Fields
- **Basic:** Name*, Type* (Hospital/Clinic/Other), Free Delivery (auto for Hospital/Clinic), Sort Order, Active
- **Address:** Line 1*, Line 2, City*, Province*, Postal Code*, Country
- **Time Slots:** Dynamic list with Day(s), Label, Start, End, Max Orders — drag to reorder

### Shipping Rates Settings (in `/admin/settings`)
- Standard Shipping: $9.95
- Express Shipping: $15.00
- Free Shipping Threshold: $100.00

---

## Predefined Hospital Locations (Seed Data)

1. Halifax Infirmary - Abbie J Lane Building
2. Halifax Infirmary - Veterans Memorial Building
3. Nova Scotia Rehab Centre
4. Victoria General - Dickson Building
5. Victoria General - Mackenzie Building
6. Victoria General - Centennial Building
7. IWK Emergency
8. IWK Hospital
9. Dalhousie - Charles Tupper Building
10. (Additional as needed)

All: `type=hospital`, `freeDelivery=true`, Halifax, NS, with 3 time slots (Morning/Afternoon/Evening) Mon-Fri.

---

## Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Cart empty on Phase 1 load | Redirect to `/cart` |
| Promo/gift card invalid | Inline error, stay on Phase 1 |
| Login fails | Inline error, stay on Phase 1 |
| Location inactive/deleted | Redirect to Phase 2 with error |
| Time slot full | Show capacity, disable slot |
| Payment fails | Stripe error message, stay on Phase 3 |
| Session expired (refresh) | Restore from `sessionStorage`, validate |
| Gift card > total | Cap at total (existing logic) |
| Hospital + custom address | Not allowed; hospital implies free delivery |

---

## Security Considerations

- All actions use React Router `action` (POST only)
- CSRF protection via SameSite cookies
- Stripe secret keys only on server
- PaymentIntent confirmed client-side, verified server-side
- Order creation only after successful payment
- Gift card balance verified server-side before application

---

## Testing Checklist

- [ ] Phase 1: Cart edits, promo, gift card, all 3 account choices
- [ ] Phase 2: Hospital/clinic/other selection, time slots, capacity, billing same/different
- [ ] Phase 3: Card payment, Apple Pay, gift card partial, full gift card cover
- [ ] Admin: CRUD locations, time slots, shipping rates
- [ ] Edge: Refresh mid-flow, back navigation, expired session
- [ ] Mobile: Touch-friendly, responsive stepper

---

## Implementation Order

1. **Prisma migrations** — DeliveryLocation, DeliveryTimeSlot, Order extensions
2. **Admin routes** — List, Create, Edit delivery locations + settings
3. **Seed script** — 10 Halifax hospitals with time slots
4. **CheckoutContext** — Shared state + sessionStorage persistence
5. **Phase 1 route** — Loader, action, UI components
6. **Phase 2 route** — Loader, action, location/time slot UI
7. **Phase 3 route** — Loader, action, Stripe Elements integration
8. **Order creation** — DB write, cart clear, email trigger
9. **Testing & polish** — Error states, loading, accessibility

---

## Out of Scope (Future Phases)

- Carrier-calculated rates (Canada Post API)
- Guest order lookup by email/order number
- Subscription/recurring orders
- Multi-address single order
- Loyalty points redemption at checkout