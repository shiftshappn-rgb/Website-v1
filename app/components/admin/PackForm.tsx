import { useMemo, useState } from "react";
import { Form, Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import { allocatePrices } from "~/lib/sets";
import { cn, formatCurrency } from "~/lib/utils";

export type PackFormCatalogProduct = {
  id: string;
  name: string;
  basePrice: number;
  status: string;
};

export type PackFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  discountType?: "fixed" | "percent" | string;
  discountValue?: number;
  status?: string;
  products?: Array<{ productId: string; isPrimary: boolean }>;
};

export function PackForm({
  catalog,
  pack,
  submitLabel,
  cancelHref = "/admin/packs",
}: {
  catalog: PackFormCatalogProduct[];
  pack?: PackFormValues;
  submitLabel: string;
  cancelHref?: string;
}) {
  const initialIds = pack?.products?.map((item) => item.productId) ?? [];
  const initialPrimary =
    pack?.products?.find((item) => item.isPrimary)?.productId ?? initialIds[0] ?? "";

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [primaryId, setPrimaryId] = useState(initialPrimary);
  const [query, setQuery] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    pack?.discountType === "percent" ? "percent" : "fixed"
  );
  const [discountValue, setDiscountValue] = useState(String(pack?.discountValue ?? 0));

  const byId = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog]
  );

  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((product): product is PackFormCatalogProduct => Boolean(product));

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((product) => {
      if (selectedIds.includes(product.id)) return false;
      if (product.status !== "active") return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q);
    });
  }, [catalog, query, selectedIds]);

  const discountNum = Number(discountValue);
  const safeDiscount = Number.isFinite(discountNum) && discountNum >= 0 ? discountNum : 0;
  const sum = selected.reduce((total, product) => total + product.basePrice, 0);
  const sellPrice = allocatePrices(
    selected.map((product) => product.basePrice),
    discountType,
    safeDiscount
  ).total;

  function addProduct(id: string) {
    if (!id || selectedIds.includes(id)) return;
    setSelectedIds((current) => {
      const next = [...current, id];
      if (!primaryId) setPrimaryId(id);
      return next;
    });
    setQuery("");
  }

  function removeProduct(id: string) {
    setSelectedIds((current) => {
      const next = current.filter((item) => item !== id);
      if (primaryId === id) setPrimaryId(next[0] ?? "");
      return next;
    });
  }

  function moveProduct(id: string, direction: "up" | "down") {
    setSelectedIds((current) => {
      const index = current.indexOf(id);
      if (index === -1) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  return (
    <Form method="post" className="space-y-6">
      <input type="hidden" name="intent" value={pack?.id ? "update" : "create"} />
      {pack?.id && <input type="hidden" name="id" value={pack.id} />}
      <input type="hidden" name="primaryProductId" value={primaryId} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="productIds" value={id} />
      ))}

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <h2 className="font-serif text-lg text-navy">Details</h2>
        <p className="text-sm text-charcoal/60">
          A bundle is a promotional group of products (not a scrub set). Shoppers configure each
          product on the bundle page.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" name="name" required defaultValue={pack?.name} />
          <Input
            label="Slug"
            name="slug"
            placeholder="auto-generated from name"
            defaultValue={pack?.slug}
          />
        </div>
        <Textarea
          label="Description"
          name="description"
          rows={3}
          className="min-h-[80px]"
          defaultValue={pack?.description ?? ""}
        />
        <Select label="Status" name="status" defaultValue={pack?.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </Select>
      </section>

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Products</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Add at least two products. Mark one as primary — it leads the card collage and bundle
            gallery.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            label="Search products"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type to filter active products"
            list="pack-product-suggestions"
          />
          <div className="flex items-end">
            <Select
              label="Add product"
              value=""
              onChange={(event) => addProduct(event.target.value)}
              className="min-w-[12rem]"
            >
              <option value="">Choose…</option>
              {available.slice(0, 40).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {formatCurrency(product.basePrice)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <datalist id="pack-product-suggestions">
          {available.slice(0, 40).map((product) => (
            <option key={product.id} value={product.name} />
          ))}
        </datalist>

        {selected.length === 0 ? (
          <p className="rounded-lg bg-sand/70 px-4 py-3 text-sm text-charcoal/70">
            No products yet. Add products from the catalogue above.
          </p>
        ) : (
          <ul className="space-y-2">
            {selected.map((product, index) => {
              const isPrimary = product.id === primaryId;
              return (
                <li
                  key={product.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                    isPrimary ? "border-navy/30 bg-navy/5" : "border-charcoal/10 bg-white"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-charcoal">
                      {product.name}
                      {isPrimary && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-navy">
                          Primary
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-charcoal/55">{formatCurrency(product.basePrice)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => setPrimaryId(product.id)}
                        className="min-h-10 rounded-full border border-navy px-3 text-xs font-medium text-navy hover:bg-navy hover:text-white"
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveProduct(product.id, "up")}
                      disabled={index === 0}
                      className="min-h-10 min-w-10 rounded border border-charcoal/20 text-sm disabled:opacity-40"
                      aria-label={`Move ${product.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveProduct(product.id, "down")}
                      disabled={index === selected.length - 1}
                      className="min-h-10 min-w-10 rounded border border-charcoal/20 text-sm disabled:opacity-40"
                      aria-label={`Move ${product.name} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      className="min-h-10 rounded-full px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Pricing</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Estimated from product base prices. Shoppers see the discounted total after they pick
            colour/size.
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
              {discountType === "percent"
                ? `${safeDiscount}%`
                : formatCurrency(safeDiscount)}
            </dd>
          </div>
          <div>
            <dt className="text-charcoal/55">Bundle price</dt>
            <dd className="text-base font-semibold text-navy">{formatCurrency(sellPrice)}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={selectedIds.length < 2 || !primaryId}>
          {submitLabel}
        </Button>
        <Link
          to={cancelHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-navy px-5 text-sm font-medium text-navy hover:bg-navy hover:text-white"
        >
          Cancel
        </Link>
      </div>
      {selectedIds.length < 2 && (
        <p className="text-sm text-charcoal/55">Add at least two products to save this bundle.</p>
      )}
    </Form>
  );
}
