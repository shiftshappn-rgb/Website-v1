export const DEFAULT_TAX_RATE_PERCENT = 13;

export function clampTaxPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value * 100) / 100;
}

export function computeTaxAmount(taxableCad: number, ratePercent: number): number {
  const rate = clampTaxPercent(ratePercent);
  if (rate <= 0 || taxableCad <= 0) return 0;
  return Math.round(taxableCad * (rate / 100) * 100) / 100;
}

export function taxLabel(ratePercent: number): string {
  const rate = clampTaxPercent(ratePercent);
  if (rate <= 0) return "Inclusive of tax";
  const pretty = Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/\.?0+$/, "");
  return `Tax (${pretty}%)`;
}
