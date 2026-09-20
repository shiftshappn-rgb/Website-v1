export const DEFAULT_GIFT_CARD_DENOMINATIONS = [50, 75, 100, 150, 200, 250];

export type GiftCardShopSettings = {
  sellEnabled: boolean;
  denominations: number[];
  introCopy: string;
};

export const DEFAULT_GIFT_CARD_SHOP: GiftCardShopSettings = {
  sellEnabled: true,
  denominations: DEFAULT_GIFT_CARD_DENOMINATIONS,
  introCopy:
    "Give the gift of choice. Digital codes are emailed after checkout and can be redeemed on any order.",
};

export function parseDenominations(raw: string): number[] {
  const values = raw
    .split(/[,;\s]+/)
    .map((part) => parseFloat(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 10);

  const unique = [...new Set(values.map((n) => Math.round(n)))].sort(
    (a, b) => a - b
  );

  return unique.length > 0 ? unique : DEFAULT_GIFT_CARD_DENOMINATIONS;
}

export function formatDenominations(values: number[]): string {
  return values.join(", ");
}
