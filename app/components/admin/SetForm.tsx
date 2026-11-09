import { useMemo, useState } from "react";
import { Form, Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { piecePrices } from "~/lib/sets";
import { formatCurrency } from "~/lib/utils";

export type SetFormCatalogProduct = {
  id: string;
  name: string;
  basePrice: number;
  status: string;
  audience?: "Women" | "Men" | null;
};

function catalogOptionLabel(product: SetFormCatalogProduct) {
  const parts = [product.name];
  if (product.audience) parts.push(product.audience);
  parts.push(formatCurrency(product.basePrice));
  const status = product.status !== "active" ? ` (${product.status})` : "";
  return `${parts.join(" · ")}${status}`;
}

export type SetFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  discountType?: "fixed" | "percent" | string;
  discountValue?: number;
  topProductId?: string;
  pantsProductId?: string;
};

export function SetForm({
  tops,
  pants,
  set,
  submitLabel,
  cancelHref = "/admin/sets",
}: {
  tops: SetFormCatalogProduct[];
  pants: SetFormCatalogProduct[];
  set?: SetFormValues;
  submitLabel: string;
  cancelHref?: string;
}) {
  const [topProductId, setTopProductId] = useState(set?.topProductId ?? "");
  const [pantsProductId, setPantsProductId] = useState(set?.pantsProductId ?? "");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    set?.discountType === "percent" ? "percent" : "fixed"
  );
  const [discountValue, setDiscountValue] = useState(String(set?.discountValue ?? 0));

  const topById = useMemo(
    () => new Map(tops.map((product) => [product.id, product])),
    [tops]
  );
  const pantsById = useMemo(
    () => new Map(pants.map((product) => [product.id, product])),
    [pants]
  );

  const top = topById.get(topProductId);
  const pantsProduct = pantsById.get(pantsProductId);
  const discountNum = Number(discountValue);
  const safeDiscount = Number.isFinite(discountNum) && discountNum >= 0 ? discountNum : 0;
  const sum = (top?.basePrice ?? 0) + (pantsProduct?.basePrice ?? 0);
  const sellPrice =
    top && pantsProduct
      ? piecePrices(top.basePrice, pantsProduct.basePrice, discountType, safeDiscount).total
      : 0;

  const canSave = Boolean(topProductId && pantsProductId && topProductId !== pantsProductId);

  return (
    <Form method="post" className="space-y-6">
      <input type="hidden" name="intent" value={set?.id ? "update" : "create"} />
      {set?.id && <input type="hidden" name="id" value={set.id} />}

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Details</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            A scrub set pairs one top and one pants product for the shop. Promo bundles can attach a
            whole set as one unit later.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" name="name" required defaultValue={set?.name} />
          <Input
            label="Slug"
            name="slug"
            placeholder="auto-generated from name"
            defaultValue={set?.slug}
          />
        </div>
        <Textarea
          label="Description"
          name="description"
          rows={3}
          className="min-h-[80px]"
          defaultValue={set?.description ?? ""}
        />
        <p className="text-xs text-charcoal/55">
          Use • between feature lines (shown on the set page).
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Pieces</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Pick active top and pants products. A product can only belong to one set.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Top product"
            name="topProductId"
            required
            value={topProductId}
            onChange={(event) => setTopProductId(event.target.value)}
          >
            <option value="">Choose top…</option>
            {tops.map((product) => (
              <option key={product.id} value={product.id}>
                {catalogOptionLabel(product)}
              </option>
            ))}
          </Select>
          <Select
            label="Pants product"
            name="pantsProductId"
            required
            value={pantsProductId}
            onChange={(event) => setPantsProductId(event.target.value)}
          >
            <option value="">Choose pants…</option>
            {pants.map((product) => (
              <option key={product.id} value={product.id}>
                {catalogOptionLabel(product)}
              </option>
            ))}
          </Select>
        </div>
        {(tops.length === 0 || pants.length === 0) && (
          <p className="text-sm text-amber-800" role="status">
            No tops or pants found. Assign products to{" "}
            <span className="font-medium">Women/Men › Scrub Tops</span> or{" "}
            <span className="font-medium">Women/Men › Scrub Pants</span> (not the Women/Men
            root categories).
          </p>
        )}
        {topProductId && pantsProductId && topProductId === pantsProductId && (
          <p className="text-sm text-red-700" role="alert">
            Top and pants must be different products.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Pricing</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Optional set discount allocated across top and pants.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Discount type"
            name="discountType"
            value={discountType}
            onChange={(event) =>
              setDiscountType(event.target.value === "percent" ? "percent" : "fixed")
            }
          >
            <option value="fixed">Fixed amount off</option>
            <option value="percent">Percent off</option>
          </Select>
          <Input
            label="Discount value"
            name="discountValue"
            type="number"
            min={0}
            step="0.01"
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
          />
        </div>
        <dl className="grid gap-3 rounded-lg bg-sand/60 px-4 py-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-charcoal/55">Sum</dt>
            <dd className="text-base font-medium text-charcoal">{formatCurrency(sum)}</dd>
          </div>
          <div>
            <dt className="text-charcoal/55">Discount</dt>
            <dd className="text-base font-medium text-charcoal">
              {discountType === "percent" ? `${safeDiscount}%` : formatCurrency(safeDiscount)}
            </dd>
          </div>
          <div>
            <dt className="text-charcoal/55">Set price</dt>
            <dd className="text-base font-semibold text-navy">{formatCurrency(sellPrice)}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canSave}>
          {submitLabel}
        </Button>
        <Link
          to={cancelHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-navy px-5 text-sm font-medium text-navy hover:bg-navy hover:text-white"
        >
          Cancel
        </Link>
      </div>
      {!canSave && (
        <p className="text-sm text-charcoal/55">Choose a top and pants product to save this set.</p>
      )}
    </Form>
  );
}
