import type { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  received: "Received",
  processing: "Processing",
  fulfilled: "Fulfilled",
  refund_initiated: "Refund initiated",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  pending: "bg-charcoal/10 text-charcoal/70",
  received: "bg-sky/15 text-navy",
  processing: "bg-amber-50 text-amber-900",
  fulfilled: "bg-emerald-50 text-emerald-800",
  refund_initiated: "bg-orange-50 text-orange-800",
  refunded: "bg-red-50 text-red-700",
  cancelled: "bg-charcoal/10 text-charcoal/50",
};

/** Statuses that count as a completed purchase for reviews / revenue. */
export const PURCHASE_ACTIVE_STATUSES: OrderStatus[] = [
  "received",
  "processing",
  "fulfilled",
];

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function canStartProcessing(status: OrderStatus): boolean {
  return status === "received";
}

export function canFulfillWithCode(status: OrderStatus): boolean {
  return status === "processing";
}

export function canInitiateRefund(status: OrderStatus): boolean {
  return (
    status === "received" ||
    status === "processing" ||
    status === "fulfilled"
  );
}
