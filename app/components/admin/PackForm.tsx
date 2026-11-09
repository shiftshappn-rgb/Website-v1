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

export type PackFormCatalogSet = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  topName: string;
  pantsName: string;
};

export type PackFormItem =
  | { kind: "product"; productId: string; isPrimary: boolean }
  | { kind: "set"; bundleId: string; isPrimary: boolean };

export type PackFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  discountType?: "fixed" | "percent" | string;
  discountValue?: number;
  status?: string;
  items?: PackFormItem[];
  /** @deprecated Prefer items */
  products?: Array<{ productId: string; isPrimary: boolean }>;
};

type LineKey = string;

function itemKey(item: PackFormItem): LineKey {
  return item.kind === "set" ? `set:${item.bundleId}` : `product:${item.productId}`;
}

function parseKey(key: LineKey): PackFormItem | null {
  if (key.startsWith("set:")) {
    return { kind: "set", bundleId: key.slice(4), isPrimary: false };
  }
  if (key.startsWith("product:")) {
    return { kind: "product", productId: key.slice(8), isPrimary: false };
  }
  return null;
}

export function PackForm({
  catalog,
  setsCatalog = [],
  pack,
  submitLabel,
  cancelHref = "/admin/packs",
}: {
  catalog: PackFormCatalogProduct[];
  setsCatalog?: PackFormCatalogSet[];
  pack?: PackFormValues;
  submitLabel: string;
  cancelHref?: string;
}) {
  const initialItems: PackFormItem[] =
    pack?.items ??
    pack?.products?.map((item) => ({
      kind: "product" as const,
      productId: item.productId,
      isPrimary: item.isPrimary,
    })) ??
    [];

  const initialKeys = initialItems.map(itemKey);
  const initialPrimary =
    initialItems.find((item) => item.isPrimary)
      ? itemKey(initialItems.find((item) => item.isPrimary)!)
      : initialKeys[0] ?? "";

  const [selectedKeys, setSelectedKeys] = useState<LineKey[]>(initialKeys);
  const [primaryKey, setPrimaryKey] = useState(initialPrimary);
  const [productQuery, setProductQuery] = useState("");
  const [setQuery, setSetQuery] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    pack?.discountType === "percent" ? "percent" : "fixed"
  );
  const [discountValue, setDiscountValue] = useState(String(pack?.discountValue ?? 0));

  const productById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog]
  );
  const setById = useMemo(
    () => new Map(setsCatalog.map((set) => [set.id, set])),
    [setsCatalog]
  );

  const selected = selectedKeys
    .map((key) => {
      const parsed = parseKey(key);
      if (!parsed) return null;
      if (parsed.kind === "set") {
        const set = setById.get(parsed.bundleId);
        if (!set) return null;
        return {
          key,
          kind: "set" as const,
          id: set.id,
          name: `${set.name} set`,
          detail: `${set.topName} + ${set.pantsName}`,
          basePrice: set.basePrice,
        };
      }
      const product = productById.get(parsed.productId);
      if (!product) return null;
      return {
        key,
        kind: "product" as const,
        id: product.id,
        name: product.name,
        detail: null as string | null,
        basePrice: product.basePrice,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const availableSets = useMemo(() => {
    const q = setQuery.trim().toLowerCase();
    return setsCatalog.filter((set) => {
      if (selectedKeys.includes(`set:${set.id}`)) return false;
      if (!q) return true;
      return (
        set.name.toLowerCase().includes(q) ||
        set.topName.toLowerCase().includes(q) ||
        set.pantsName.toLowerCase().includes(q)
      );
    });
  }, [selectedKeys, setQuery, setsCatalog]);

  const availableProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return catalog.filter((product) => {
      if (selectedKeys.includes(`product:${product.id}`)) return false;
      if (product.status !== "active") return false;
      if (!q) return true;
      return product.name.toLowerCase().includes(q);
    });
  }, [catalog, productQuery, selectedKeys]);

  const discountNum = Number(discountValue);
  const safeDiscount = Number.isFinite(discountNum) && discountNum >= 0 ? discountNum : 0;
  const sum = selected.reduce((total, row) => total + row.basePrice, 0);
  const sellPrice = allocatePrices(
    selected.map((row) => row.basePrice),
    discountType,
    safeDiscount
  ).total;

  function addKey(key: LineKey) {
    if (!key || selectedKeys.includes(key)) return;
    setSelectedKeys((current) => {
      const next = [...current, key];
      if (!primaryKey) setPrimaryKey(key);
      return next;
    });
  }

  function removeKey(key: LineKey) {
    setSelectedKeys((current) => {
      const next = current.filter((item) => item !== key);
      if (primaryKey === key) setPrimaryKey(next[0] ?? "");
      return next;
    });
  }

  function moveKey(key: LineKey, direction: "up" | "down") {
    setSelectedKeys((current) => {
      const index = current.indexOf(key);
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
      <input type="hidden" name="primaryItemKey" value={primaryKey} />
      {selected.map((row) => (
        <span key={row.key}>
          <input type="hidden" name="itemKinds" value={row.kind} />
          <input type="hidden" name="itemIds" value={row.id} />
        </span>
      ))}

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <h2 className="font-serif text-lg text-navy">Details</h2>
        <p className="text-sm text-charcoal/60">
          Bundles are promo offers. Add a scrub set first, then extras. Shoppers configure the set as
          one unit on the bundle page.
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
          <h2 className="font-serif text-lg text-navy">Add a scrub set</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Attaches the whole top + pants set as one unit. Create sets under Admin → Sets.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            label="Search sets"
            value={setQuery}
            onChange={(event) => setSetQuery(event.target.value)}
            placeholder="Filter scrub sets"
          />
          <div className="flex items-end">
            <Select
              label="Add set"
              value=""
              onChange={(event) => {
                if (event.target.value) addKey(`set:${event.target.value}`);
              }}
              className="min-w-[12rem]"
            >
              <option value="">Choose…</option>
              {availableSets.slice(0, 40).map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name} set · {formatCurrency(set.basePrice)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {setsCatalog.length === 0 && (
          <p className="rounded-lg bg-sand/70 px-4 py-3 text-sm text-charcoal/70">
            No scrub sets yet.{" "}
            <Link to="/admin/sets/new" className="font-medium text-navy underline-offset-4 hover:underline">
              Create a set
            </Link>{" "}
            first, then come back.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Add other products</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Accessories or standalone pieces. Need at least two units total (set + product, or two
            products).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            label="Search products"
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder="Type to filter active products"
            list="pack-product-suggestions"
          />
          <div className="flex items-end">
            <Select
              label="Add product"
              value=""
              onChange={(event) => {
                if (event.target.value) addKey(`product:${event.target.value}`);
              }}
              className="min-w-[12rem]"
            >
              <option value="">Choose…</option>
              {availableProducts.slice(0, 40).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {formatCurrency(product.basePrice)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <datalist id="pack-product-suggestions">
          {availableProducts.slice(0, 40).map((product) => (
            <option key={product.id} value={product.name} />
          ))}
        </datalist>
      </section>

      <section className="space-y-4 rounded-xl border border-charcoal/10 bg-white p-5">
        <div>
          <h2 className="font-serif text-lg text-navy">Bundle contents</h2>
          <p className="mt-1 text-sm text-charcoal/60">
            Mark one item as primary — it leads the card collage and gallery.
          </p>
        </div>

        {selected.length === 0 ? (
          <p className="rounded-lg bg-sand/70 px-4 py-3 text-sm text-charcoal/70">
            No items yet. Add a scrub set and/or products above.
          </p>
        ) : (
          <ul className="space-y-2">
            {selected.map((row, index) => {
              const isPrimary = row.key === primaryKey;
              return (
                <li
                  key={row.key}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                    isPrimary ? "border-navy/30 bg-navy/5" : "border-charcoal/10 bg-white"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-charcoal">
                      {row.name}
                      {row.kind === "set" && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-charcoal/45">
                          Set
                        </span>
                      )}
                      {isPrimary && (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-navy">
                          Primary
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-charcoal/55">
                      {row.detail ? `${row.detail} · ` : ""}
                      {formatCurrency(row.basePrice)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => setPrimaryKey(row.key)}
                        className="min-h-11 rounded-full border border-navy px-3 text-xs font-medium text-navy hover:bg-navy hover:text-white"
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveKey(row.key, "up")}
                      disabled={index === 0}
                      className="min-h-11 min-w-11 rounded border border-charcoal/20 text-sm disabled:opacity-40"
                      aria-label={`Move ${row.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveKey(row.key, "down")}
                      disabled={index === selected.length - 1}
                      className="min-h-11 min-w-11 rounded border border-charcoal/20 text-sm disabled:opacity-40"
                      aria-label={`Move ${row.name} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeKey(row.key)}
                      className="min-h-11 rounded-full px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                      aria-label={`Remove ${row.name}`}
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
            Estimated from base prices (sets use top + pants sum). Shoppers see the discounted total
            after they pick colour/size.
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
        <Button type="submit" disabled={selectedKeys.length < 2 || !primaryKey}>
          {submitLabel}
        </Button>
        <Link
          to={cancelHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-navy px-5 text-sm font-medium text-navy hover:bg-navy hover:text-white"
        >
          Cancel
        </Link>
      </div>
      {selectedKeys.length < 2 && (
        <p className="text-sm text-charcoal/55">
          Add at least two items (for example a scrub set plus an accessory) to save this bundle.
        </p>
      )}
    </Form>
  );
}
