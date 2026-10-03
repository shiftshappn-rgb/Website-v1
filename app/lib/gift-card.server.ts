import type { tryDb } from "~/db.server";
import {
  DEFAULT_GIFT_CARD_DENOMINATIONS,
  DEFAULT_GIFT_CARD_SHOP,
  parseDenominations,
  type GiftCardShopSettings,
} from "~/lib/gift-card.shared";

export {
  DEFAULT_GIFT_CARD_DENOMINATIONS,
  DEFAULT_GIFT_CARD_SHOP,
  parseDenominations,
  formatDenominations,
  type GiftCardShopSettings,
} from "~/lib/gift-card.shared";

type Db = NonNullable<ReturnType<typeof tryDb>>;

const SETTINGS_KEYS = {
  sellEnabled: "giftCardSellEnabled",
  denominations: "giftCardDenominations",
  introCopy: "giftCardIntroCopy",
} as const;

export function giftCardLineId(
  amount: number,
  recipientEmail?: string,
  giftNote?: string
) {
  const recipient = recipientEmail?.trim().toLowerCase() || "self";
  const note = giftNote?.trim().slice(0, 32) || "";
  return `gift-card-${amount}-${recipient}-${note}`;
}

export async function loadGiftCardShopSettings(
  db: Db | null
): Promise<GiftCardShopSettings> {
  if (!db) return DEFAULT_GIFT_CARD_SHOP;

  const rows = await db.siteSetting.findMany({
    where: { key: { in: Object.values(SETTINGS_KEYS) } },
  });

  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  const sellRaw = map[SETTINGS_KEYS.sellEnabled];
  const denomRaw = map[SETTINGS_KEYS.denominations];
  const introRaw = map[SETTINGS_KEYS.introCopy];

  let sellEnabled = DEFAULT_GIFT_CARD_SHOP.sellEnabled;
  if (typeof sellRaw === "boolean") sellEnabled = sellRaw;
  else if (typeof sellRaw === "object" && sellRaw && "enabled" in sellRaw) {
    sellEnabled = Boolean((sellRaw as { enabled: boolean }).enabled);
  }

  let denominations = DEFAULT_GIFT_CARD_SHOP.denominations;
  if (typeof denomRaw === "string") {
    denominations = parseDenominations(denomRaw);
  } else if (Array.isArray(denomRaw)) {
    denominations = parseDenominations(denomRaw.join(", "));
  } else if (
    typeof denomRaw === "object" &&
    denomRaw &&
    "values" in denomRaw &&
    Array.isArray((denomRaw as { values: unknown[] }).values)
  ) {
    denominations = parseDenominations(
      (denomRaw as { values: number[] }).values.join(", ")
    );
  }

  let introCopy = DEFAULT_GIFT_CARD_SHOP.introCopy;
  if (typeof introRaw === "string") introCopy = introRaw;
  else if (typeof introRaw === "object" && introRaw && "text" in introRaw) {
    introCopy = String((introRaw as { text: string }).text);
  }

  return { sellEnabled, denominations, introCopy };
}

export async function saveGiftCardShopSettings(
  db: Db,
  settings: GiftCardShopSettings
) {
  const updates = [
    {
      key: SETTINGS_KEYS.sellEnabled,
      value: { enabled: settings.sellEnabled },
    },
    {
      key: SETTINGS_KEYS.denominations,
      value: { values: settings.denominations },
    },
    {
      key: SETTINGS_KEYS.introCopy,
      value: { text: settings.introCopy },
    },
  ];

  for (const update of updates) {
    await db.siteSetting.upsert({
      where: { key: update.key },
      create: update,
      update: { value: update.value },
    });
  }
}
