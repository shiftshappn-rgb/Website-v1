import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";
import { ColorHexInput } from "~/components/admin/ColorHexInput";
import { Button } from "~/components/ui/Button";
import { Input, Select } from "~/components/ui/Input";
import { buildVariantSku, CATALOG_SIZES } from "~/lib/product-catalog";
import { cn } from "~/lib/utils";

type ActionResult = {
  error?: string;
  success?: string;
};

type CatalogColor = { id: string; name: string; hex: string };

type ExistingVariant = {
  colorName: string;
  size: string;
};

type Mode = "quick" | "colour-sizes" | "matrix";

type PreviewRow = {
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  exists: boolean;
  key: string;
};

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: "quick", label: "Quick add", hint: "One colour + one size" },
  { id: "colour-sizes", label: "Colour in sizes", hint: "One colour × chosen sizes" },
  { id: "matrix", label: "Size matrix", hint: "Many colours × many sizes" },
];

function inventoryKey(colorName: string, size: string) {
  return `${colorName}::${size}`;
}

export function AddVariantForm({
  productSlug,
  catalogColors,
  existingVariants,
}: {
  productSlug: string;
  catalogColors: CatalogColor[];
  existingVariants: ExistingVariant[];
}) {
  const fetcher = useFetcher<ActionResult>();
  const revalidator = useRevalidator();
  const [mode, setMode] = useState<Mode>("quick");
  const [formKey, setFormKey] = useState(0);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#B07A7A");
  const [size, setSize] = useState<string>(CATALOG_SIZES[2]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([...CATALOG_SIZES]);
  const [matrixColors, setMatrixColors] = useState<CatalogColor[]>([]);
  const [inventoryQty, setInventoryQty] = useState("0");
  const [inventoryByKey, setInventoryByKey] = useState<Record<string, string>>({});
  const [priceOverride, setPriceOverride] = useState("");
  const [handledSuccess, setHandledSuccess] = useState<string | null>(null);
  const saving = fetcher.state !== "idle";

  const existingKeys = useMemo(
    () => new Set(existingVariants.map((variant) => inventoryKey(variant.colorName, variant.size))),
    [existingVariants]
  );

  useEffect(() => {
    const success = fetcher.data?.success;
    if (fetcher.state !== "idle" || !success || success === handledSuccess) return;

    setHandledSuccess(success);
    setFormKey((key) => key + 1);
    setColorName("");
    setColorHex("#B07A7A");
    setSize(CATALOG_SIZES[2]);
    setSelectedSizes([...CATALOG_SIZES]);
    setMatrixColors([]);
    setInventoryQty("0");
    setInventoryByKey({});
    setPriceOverride("");
    setMode("quick");
    revalidator.revalidate();
  }, [fetcher.state, fetcher.data, handledSuccess, revalidator]);

  function toggleSize(value: string) {
    setSelectedSizes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function toggleMatrixColor(color: CatalogColor) {
    setMatrixColors((current) => {
      const exists = current.some((item) => item.name === color.name);
      if (exists) return current.filter((item) => item.name !== color.name);
      return [...current, color];
    });
  }

  function setRowInventory(key: string, value: string) {
    setInventoryByKey((current) => ({ ...current, [key]: value }));
  }

  function applyInventoryToAll(rows: PreviewRow[]) {
    const next: Record<string, string> = { ...inventoryByKey };
    for (const row of rows) {
      if (!row.exists) next[row.key] = inventoryQty || "0";
    }
    setInventoryByKey(next);
  }

  const previewRows = useMemo((): PreviewRow[] => {
    if (mode === "quick") {
      if (!colorName.trim() || !size) return [];
      const key = inventoryKey(colorName.trim(), size);
      return [
        {
          colorName: colorName.trim(),
          colorHex,
          size,
          sku: buildVariantSku(productSlug, colorName, size),
          exists: existingKeys.has(key),
          key,
        },
      ];
    }

    const colors =
      mode === "colour-sizes"
        ? colorName.trim()
          ? [{ name: colorName.trim(), hex: colorHex }]
          : []
        : matrixColors.map((color) => ({ name: color.name, hex: color.hex }));

    const rows: PreviewRow[] = [];

    for (const color of colors) {
      for (const sizeValue of selectedSizes) {
        const key = inventoryKey(color.name, sizeValue);
        rows.push({
          colorName: color.name,
          colorHex: color.hex,
          size: sizeValue,
          sku: buildVariantSku(productSlug, color.name, sizeValue),
          exists: existingKeys.has(key),
          key,
        });
      }
    }
    return rows;
  }, [
    mode,
    colorName,
    colorHex,
    size,
    selectedSizes,
    matrixColors,
    productSlug,
    existingKeys,
  ]);

  const toCreate = previewRows.filter((row) => !row.exists);
  const alreadyExist = previewRows.length - toCreate.length;

  function rowQty(row: PreviewRow) {
    if (inventoryByKey[row.key] != null) return inventoryByKey[row.key];
    return inventoryQty || "0";
  }

  function submit() {
    if (toCreate.length === 0) return;

    const formData = new FormData();
    formData.set("inventoryQty", inventoryQty || "0");

    if (mode === "quick") {
      formData.set("intent", "add-variant");
      formData.set("colorName", colorName.trim());
      formData.set("colorHex", colorHex);
      formData.set("size", size);
      formData.set("inventoryQty", rowQty(toCreate[0]) || "0");
      if (priceOverride.trim()) formData.set("priceOverride", priceOverride.trim());
    } else if (mode === "colour-sizes") {
      formData.set("intent", "add-color-sizes");
      formData.set("colorName", colorName.trim());
      formData.set("colorHex", colorHex);
      for (const sizeValue of selectedSizes) {
        formData.append("sizes", sizeValue);
      }
      const inventories: Record<string, number> = {};
      for (const row of toCreate) {
        const qty = parseInt(rowQty(row), 10);
        inventories[row.key] = Number.isNaN(qty) ? 0 : Math.max(0, qty);
      }
      formData.set("inventories", JSON.stringify(inventories));
    } else {
      formData.set("intent", "add-matrix");
      formData.set(
        "colors",
        JSON.stringify(matrixColors.map((color) => ({ name: color.name, hex: color.hex })))
      );
      for (const sizeValue of selectedSizes) {
        formData.append("sizes", sizeValue);
      }
      const inventories: Record<string, number> = {};
      for (const row of toCreate) {
        const qty = parseInt(rowQty(row), 10);
        inventories[row.key] = Number.isNaN(qty) ? 0 : Math.max(0, qty);
      }
      formData.set("inventories", JSON.stringify(inventories));
    }

    fetcher.submit(formData, { method: "post" });
  }

  const canSubmit =
    !saving &&
    toCreate.length > 0 &&
    (mode !== "matrix" || matrixColors.length > 0) &&
    (mode === "matrix" || colorName.trim().length > 0) &&
    (mode === "quick" ? Boolean(size) : selectedSizes.length > 0);

  return (
    <div className="rounded-lg border border-dashed border-charcoal/20 p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-navy">Add variants</h3>
        <Link
          to="/admin/colors"
          className="text-xs font-medium text-navy underline underline-offset-4 hover:text-terracotta"
        >
          Manage colours
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Variant creation mode">
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(item.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-left text-sm transition-colors",
                active
                  ? "border-navy bg-navy text-white"
                  : "border-charcoal/15 bg-white text-charcoal hover:border-navy/40"
              )}
            >
              <span className="font-medium">{item.label}</span>
              <span className={cn("ml-2 text-xs", active ? "text-white/70" : "text-charcoal/50")}>
                {item.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {mode !== "matrix" && (
          <ColorHexInput
            key={`color-${formKey}`}
            name="colorName"
            hexName="colorHex"
            defaultName={colorName}
            defaultHex={colorHex}
            palette={catalogColors}
            onChange={({ name: nextName, hex }) => {
              setColorName(nextName);
              setColorHex(hex);
            }}
          />
        )}

        {mode === "quick" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Size"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            >
              {CATALOG_SIZES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Input
              label="Inventory"
              type="number"
              min={0}
              value={inventoryQty}
              onChange={(event) => setInventoryQty(event.target.value)}
            />
            <Input
              label="Price override"
              type="number"
              step="0.01"
              value={priceOverride}
              onChange={(event) => setPriceOverride(event.target.value)}
              placeholder="Optional"
            />
          </div>
        )}

        {mode === "colour-sizes" && (
          <SizePillGroup
            selected={selectedSizes}
            onToggle={toggleSize}
            onSelectAll={() => setSelectedSizes([...CATALOG_SIZES])}
            onClear={() => setSelectedSizes([])}
          />
        )}

        {mode === "matrix" && (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-charcoal">Colours</p>
                <button
                  type="button"
                  className="text-xs font-medium text-navy underline underline-offset-4"
                  onClick={() =>
                    setMatrixColors(
                      matrixColors.length === catalogColors.length ? [] : [...catalogColors]
                    )
                  }
                >
                  {matrixColors.length === catalogColors.length
                    ? "Clear colours"
                    : "Select all colours"}
                </button>
              </div>
              {catalogColors.length === 0 ? (
                <p className="text-sm text-charcoal/60">
                  No catalogue colours yet.{" "}
                  <Link to="/admin/colors" className="underline underline-offset-4">
                    Add colours
                  </Link>
                  .
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {catalogColors.map((color) => {
                    const selected = matrixColors.some((item) => item.name === color.name);
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => toggleMatrixColor(color)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          selected
                            ? "border-navy bg-navy/5 text-navy ring-1 ring-navy/20"
                            : "border-charcoal/15 bg-white text-charcoal hover:border-navy/40"
                        )}
                      >
                        <span
                          className="size-3.5 rounded-full border border-charcoal/15"
                          style={{ backgroundColor: color.hex }}
                          aria-hidden
                        />
                        {color.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <SizePillGroup
              selected={selectedSizes}
              onToggle={toggleSize}
              onSelectAll={() => setSelectedSizes([...CATALOG_SIZES])}
              onClear={() => setSelectedSizes([])}
            />
          </>
        )}

        {(mode === "colour-sizes" || mode === "matrix") && toCreate.length > 0 && (
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Fill all inventories"
              type="number"
              min={0}
              className="max-w-[10rem]"
              value={inventoryQty}
              onChange={(event) => setInventoryQty(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => applyInventoryToAll(previewRows)}
            >
              Apply to all sizes
            </Button>
          </div>
        )}

        <SkuPreview
          rows={previewRows}
          toCreateCount={toCreate.length}
          alreadyExist={alreadyExist}
          showInventory={mode !== "quick"}
          getInventory={rowQty}
          onInventoryChange={setRowInventory}
        />

        {fetcher.data?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {fetcher.data.error}
          </p>
        )}
        {fetcher.data?.success && fetcher.state === "idle" && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {fetcher.data.success}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="terracotta"
            disabled={!canSubmit}
            onClick={submit}
          >
            {saving
              ? "Adding…"
              : mode === "quick"
                ? "Add variant"
                : `Add ${toCreate.length} variant${toCreate.length === 1 ? "" : "s"}`}
          </Button>
          <p className="text-xs text-charcoal/50">
            SKUs auto-generate as{" "}
            <code className="rounded bg-sand px-1 py-0.5 text-[11px]">
              {productSlug}-COLOR-SIZE
            </code>
            . Set inventory per size before adding.
          </p>
        </div>
      </div>
    </div>
  );
}

function SizePillGroup({
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: {
  selected: string[];
  onToggle: (size: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const allSelected = selected.length === CATALOG_SIZES.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-charcoal">Sizes</p>
        <button
          type="button"
          className="text-xs font-medium text-navy underline underline-offset-4"
          onClick={allSelected ? onClear : onSelectAll}
        >
          {allSelected ? "Clear sizes" : "Select all sizes"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATALOG_SIZES.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={cn(
                "min-w-12 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-navy bg-navy text-white"
                  : "border-charcoal/15 bg-white text-charcoal hover:border-navy/40"
              )}
              aria-pressed={active}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SkuPreview({
  rows,
  toCreateCount,
  alreadyExist,
  showInventory,
  getInventory,
  onInventoryChange,
}: {
  rows: PreviewRow[];
  toCreateCount: number;
  alreadyExist: number;
  showInventory: boolean;
  getInventory: (row: PreviewRow) => string;
  onInventoryChange: (key: string, value: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-charcoal/10 bg-sand/40 px-3 py-3 text-sm text-charcoal/60">
        Pick a colour and size to preview SKUs and inventory.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-charcoal/10 bg-sand/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-charcoal">
          Preview · {toCreateCount} new
          {alreadyExist > 0 ? `, ${alreadyExist} already exist` : ""}
        </p>
        {showInventory && (
          <p className="text-xs text-charcoal/50">Inventory per size</p>
        )}
      </div>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
        {rows.map((row) => (
          <li
            key={row.key}
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-md bg-white/70 px-2 py-1.5",
              row.exists && "opacity-50"
            )}
          >
            <span
              className="size-3.5 shrink-0 rounded-full border border-charcoal/15"
              style={{ backgroundColor: row.colorHex }}
              aria-hidden
            />
            <span className="min-w-[6.5rem] font-medium text-charcoal">
              {row.colorName} / {row.size}
            </span>
            <code className="min-w-0 flex-1 truncate text-xs text-charcoal/60">{row.sku}</code>
            {row.exists ? (
              <span className="text-xs text-charcoal/50">already exists — skipped</span>
            ) : showInventory ? (
              <label className="ml-auto flex items-center gap-1.5 text-xs text-charcoal/60">
                Qty
                <input
                  type="number"
                  min={0}
                  value={getInventory(row)}
                  onChange={(event) => onInventoryChange(row.key, event.target.value)}
                  aria-label={`Inventory for ${row.colorName} ${row.size}`}
                  className="w-16 rounded-md border border-charcoal/20 bg-white px-2 py-1 text-sm text-charcoal focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </label>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
