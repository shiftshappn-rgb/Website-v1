import type { tryDb } from "~/db.server";
import {
  clampTaxPercent,
  DEFAULT_TAX_RATE_PERCENT,
} from "~/lib/tax";

export {
  clampTaxPercent,
  computeTaxAmount,
  DEFAULT_TAX_RATE_PERCENT,
  taxLabel,
} from "~/lib/tax";

type Db = NonNullable<ReturnType<typeof tryDb>>;

export const TAX_RATE_SETTING_KEY = "taxRate";

/** Tax rate as a percent (e.g. 13 = 13%). 0 = prices treated as tax-inclusive. */
export async function loadTaxRatePercent(db: Db | null): Promise<number> {
  if (!db) return DEFAULT_TAX_RATE_PERCENT;

  const row = await db.siteSetting.findUnique({
    where: { key: TAX_RATE_SETTING_KEY },
  });
  if (!row) return DEFAULT_TAX_RATE_PERCENT;

  const value = row.value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampTaxPercent(value);
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) return clampTaxPercent(parsed);
  }
  if (value && typeof value === "object" && !Array.isArray(value) && "percent" in value) {
    const percent = Number((value as { percent: unknown }).percent);
    if (Number.isFinite(percent)) return clampTaxPercent(percent);
  }

  return DEFAULT_TAX_RATE_PERCENT;
}
