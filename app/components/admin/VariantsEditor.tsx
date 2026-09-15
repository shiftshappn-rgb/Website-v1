import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/Button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/Input";
import { ColorHexInput } from "~/components/admin/ColorHexInput";
import type { VariantImage } from "~/lib/utils";

type ActionResult = {
  error?: string;
  success?: string;
};

export type EditVariant = {
  id: string;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  priceOverride: number | null;
  inventoryQty: number;
  images: VariantImage[];
};

export function VariantsEditor({ variants }: { variants: EditVariant[] }) {
  const deleteFetcher = useFetcher<ActionResult>();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<EditVariant[] | null>(null);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      setPending(null);
      setSelected([]);
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  const allSelected = variants.length > 0 && selected.length === variants.length;
  const someSelected = selected.length > 0 && !allSelected;
  const deleting = deleteFetcher.state !== "idle";

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((variantId) => variantId !== id)
    );
  }

  function submitDelete(items: EditVariant[]) {
    const formData = new FormData();
    formData.set(
      "intent",
      items.length > 1 ? "bulk-delete-variants" : "delete-variant"
    );
    for (const item of items) {
      formData.append("variantId", item.id);
    }
    deleteFetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(checked) =>
              setSelected(checked ? variants.map((variant) => variant.id) : [])
            }
            aria-label="Select all variants"
          />
          Select variants
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-700"
          disabled={selected.length === 0}
          onClick={() =>
            setPending(variants.filter((variant) => selected.includes(variant.id)))
          }
        >
          Delete selected{selected.length > 0 ? ` (${selected.length})` : ""}
        </Button>
      </div>

      {deleteFetcher.data?.error && !pending && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {deleteFetcher.data.error}
        </p>
      )}
      {deleteFetcher.data?.success && deleteFetcher.state === "idle" && !pending && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {deleteFetcher.data.success}
        </p>
      )}

      <div className="hidden gap-3 text-xs font-medium uppercase tracking-wide text-charcoal/50 md:grid md:grid-cols-[auto_1.2fr_5.5rem_1fr_6rem_6rem_auto]">
        <span className="w-4" aria-hidden />
        <span>Colour</span>
        <span>Size</span>
        <span>SKU</span>
        <span>Inventory</span>
        <span>Price override</span>
        <span className="sr-only">Actions</span>
      </div>

      {variants.map((variant) => (
        <VariantRow
          key={variant.id}
          variant={variant}
          selected={selected.includes(variant.id)}
          onSelectedChange={(checked) => toggle(variant.id, checked)}
          onRequestDelete={() => setPending([variant])}
        />
      ))}

      <AlertDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.length === 1 ? "Delete this variant?" : "Delete selected variants?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the size/SKU from the product. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-charcoal/10 bg-sand/40 p-3">
              {pending.map((variant) => (
                <li key={variant.id} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-0.5 size-5 shrink-0 rounded-full border border-charcoal/15"
                    style={{ backgroundColor: variant.colorHex }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium text-charcoal">
                      {variant.colorName} / {variant.size}
                    </p>
                    <p className="text-charcoal/60">SKU {variant.sku}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {deleteFetcher.data?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteFetcher.data.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting || !pending}
              onClick={(event) => {
                event.preventDefault();
                if (pending) submitDelete(pending);
              }}
            >
              {deleting
                ? "Deleting…"
                : pending?.length === 1
                  ? `Delete ${pending[0].colorName} / ${pending[0].size}`
                  : `Delete ${pending?.length ?? 0} variants`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VariantRow({
  variant,
  selected,
  onSelectedChange,
  onRequestDelete,
}: {
  variant: EditVariant;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onRequestDelete: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const saving = fetcher.state !== "idle";

  return (
    <div className="rounded-lg border border-charcoal/10 p-3 md:border-0 md:p-0">
      <fetcher.Form
        method="post"
        className="grid gap-3 md:grid-cols-[auto_1.2fr_5.5rem_1fr_6rem_6rem_auto] md:items-end"
      >
        <div className="flex items-center md:pb-2.5">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(Boolean(checked))}
            aria-label={`Select ${variant.colorName} ${variant.size}`}
          />
        </div>
        <input type="hidden" name="intent" value="update-variant" />
        <input type="hidden" name="variantId" value={variant.id} />
        <ColorHexInput
          key={`${variant.id}-${variant.colorHex}`}
          name="colorName"
          hexName="colorHex"
          defaultName={variant.colorName}
          defaultHex={variant.colorHex}
          id={`color-${variant.id}`}
          compact
        />
        <Input
          id={`size-${variant.id}`}
          name="size"
          defaultValue={variant.size}
          required
          aria-label="Size"
        />
        <Input
          id={`sku-${variant.id}`}
          name="sku"
          defaultValue={variant.sku}
          required
          aria-label="SKU"
        />
        <Input
          id={`inventory-${variant.id}`}
          name="inventoryQty"
          type="number"
          defaultValue={variant.inventoryQty}
          aria-label="Inventory"
        />
        <Input
          id={`price-${variant.id}`}
          name="priceOverride"
          type="number"
          step="0.01"
          defaultValue={variant.priceOverride ?? ""}
          aria-label="Price override"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-red-700"
            onClick={onRequestDelete}
          >
            Delete
          </Button>
        </div>
      </fetcher.Form>
      {fetcher.data?.error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {fetcher.data.error}
        </p>
      )}
    </div>
  );
}
