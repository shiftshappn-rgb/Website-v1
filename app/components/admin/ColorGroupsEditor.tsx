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
import { VariantImageGallery } from "~/components/admin/VariantImageGallery";
import type { VariantImage } from "~/lib/utils";

type ActionResult = {
  error?: string;
  success?: string;
};

export type ColorGroup = {
  colorName: string;
  colorHex: string;
  images: VariantImage[];
  variants: Array<{ size: string }>;
};

export function ColorGroupsEditor({
  groups,
  productName,
  cloudName,
}: {
  groups: ColorGroup[];
  productName: string;
  cloudName: string | null;
}) {
  const deleteFetcher = useFetcher<ActionResult>();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<ColorGroup[] | null>(null);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      setPending(null);
      setSelected([]);
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  const allSelected = groups.length > 0 && selected.length === groups.length;
  const someSelected = selected.length > 0 && !allSelected;
  const deleting = deleteFetcher.state !== "idle";

  function toggle(colorName: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, colorName] : current.filter((name) => name !== colorName)
    );
  }

  function submitDelete(colors: ColorGroup[]) {
    const formData = new FormData();
    formData.set("intent", colors.length > 1 ? "bulk-delete-colors" : "delete-color");
    for (const color of colors) {
      formData.append("colorName", color.colorName);
    }
    deleteFetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(checked) =>
              setSelected(checked ? groups.map((group) => group.colorName) : [])
            }
            aria-label="Select all colours"
          />
          Select colours
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-700"
          disabled={selected.length === 0}
          onClick={() =>
            setPending(groups.filter((group) => selected.includes(group.colorName)))
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

      {groups.map((group) => (
        <ColorMediaBlock
          key={group.colorName}
          colorName={group.colorName}
          colorHex={group.colorHex}
          images={group.images}
          sizes={group.variants.map((variant) => variant.size)}
          productName={productName}
          cloudName={cloudName}
          selected={selected.includes(group.colorName)}
          onSelectedChange={(checked) => toggle(group.colorName, checked)}
          onRequestDelete={() => setPending([group])}
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
              {pending?.length === 1 ? "Delete this colour?" : "Delete selected colours?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the colour{pending && pending.length > 1 ? "s" : ""}, all sizes,
              and photos from this product. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending && (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-charcoal/10 bg-sand/40 p-3">
              {pending.map((color) => (
                <li key={color.colorName} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-0.5 size-5 shrink-0 rounded-full border border-charcoal/15"
                    style={{ backgroundColor: color.colorHex }}
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium text-charcoal">{color.colorName}</p>
                    <p className="text-charcoal/60">
                      {color.variants.length} size
                      {color.variants.length === 1 ? "" : "s"}:{" "}
                      {color.variants.map((variant) => variant.size).join(", ")}
                    </p>
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
                  ? `Delete ${pending[0].colorName}`
                  : `Delete ${pending?.length ?? 0} colours`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ColorMediaBlock({
  colorName,
  colorHex,
  images,
  sizes,
  productName,
  cloudName,
  selected,
  onSelectedChange,
  onRequestDelete,
}: {
  colorName: string;
  colorHex: string;
  images: VariantImage[];
  sizes: string[];
  productName: string;
  cloudName: string | null;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onRequestDelete: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const saving = fetcher.state !== "idle";

  function persist(next: VariantImage[]) {
    const formData = new FormData();
    formData.set("intent", "update-color-images");
    formData.set("colorName", colorName);
    formData.set("images", JSON.stringify(next));
    fetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="space-y-3 rounded-lg border border-charcoal/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(Boolean(checked))}
            aria-label={`Select ${colorName}`}
          />
          <span
            className="size-4 rounded-full border border-charcoal/15"
            style={{ backgroundColor: colorHex }}
            aria-hidden
          />
          <h3 className="font-medium text-navy">{colorName}</h3>
          <span className="text-xs text-charcoal/50">{sizes.join(", ")}</span>
          {saving && <span className="text-xs text-charcoal/50">Saving…</span>}
          {fetcher.data?.success && fetcher.state === "idle" && (
            <span className="text-xs text-green-700">{fetcher.data.success}</span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-red-700"
          onClick={onRequestDelete}
        >
          Delete colour
        </Button>
      </div>
      {fetcher.data?.error && (
        <p className="text-sm text-red-700" role="alert">
          {fetcher.data.error}
        </p>
      )}
      <VariantImageGallery
        images={images}
        cloudName={cloudName}
        defaultAlt={`${productName} ${colorName}`}
        onChange={persist}
      />
    </div>
  );
}
