import { useMemo, useState } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input, Select } from "~/components/ui/Input";
import type { ProductGridContent } from "~/components/homepage-blocks/types";

type CatalogProduct = { slug: string; name: string };

export function ProductGridBlockEditor({
  blockId,
  content,
  catalogProducts,
}: {
  blockId: string;
  content: ProductGridContent;
  catalogProducts: CatalogProduct[];
}) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(content.productSlugs ?? []);
  const [layout, setLayout] = useState<"grid" | "carousel">(content.layout ?? "grid");

  const availableProducts = useMemo(
    () => catalogProducts.filter((product) => !selectedSlugs.includes(product.slug)),
    [catalogProducts, selectedSlugs]
  );

  function addProduct(slug: string) {
    if (!slug || selectedSlugs.includes(slug)) return;
    setSelectedSlugs((current) => [...current, slug]);
  }

  function removeProduct(slug: string) {
    setSelectedSlugs((current) => current.filter((item) => item !== slug));
  }

  function moveProduct(slug: string, direction: "up" | "down") {
    setSelectedSlugs((current) => {
      const index = current.indexOf(slug);
      if (index === -1) return current;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  const productNameBySlug = useMemo(
    () => new Map(catalogProducts.map((product) => [product.slug, product.name])),
    [catalogProducts]
  );

  return (
    <Form method="post" className="space-y-4 rounded-lg border border-charcoal/10 bg-stone/30 p-4">
      <input type="hidden" name="intent" value="updateProductGrid" />
      <input type="hidden" name="id" value={blockId} />
      <input type="hidden" name="layout" value={layout} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Headline"
          name="headline"
          defaultValue={content.headline ?? "Best sellers"}
          required
        />
        <Select
          label="Layout"
          value={layout}
          onChange={(event) => setLayout(event.target.value as "grid" | "carousel")}
        >
          <option value="grid">Grid</option>
          <option value="carousel">Carousel</option>
        </Select>
      </div>

      <Input
        label='Collection slug (for "View all" link fallback)'
        name="collectionSlug"
        defaultValue={content.collectionSlug ?? ""}
        placeholder="best-sellers"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-charcoal">Selected products</p>
        {selectedSlugs.length === 0 ? (
          <p className="text-sm text-charcoal/60">
            No products selected. Add products below, or leave empty to use the collection.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedSlugs.map((slug, index) => (
              <li
                key={slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal/10 bg-white px-3 py-2"
              >
                <span className="text-sm text-charcoal">
                  {index + 1}. {productNameBySlug.get(slug) ?? slug}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-w-11"
                    disabled={index === 0}
                    onClick={() => moveProduct(slug, "up")}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-w-11"
                    disabled={index === selectedSlugs.length - 1}
                    onClick={() => moveProduct(slug, "down")}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11 text-red-600"
                    onClick={() => removeProduct(slug)}
                  >
                    Remove
                  </Button>
                </div>
                <input type="hidden" name="productSlugs" value={slug} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Add product"
          defaultValue=""
          onChange={(event) => {
            addProduct(event.target.value);
            event.target.value = "";
          }}
          className="min-w-[240px]"
        >
          <option value="">Choose a product…</option>
          {availableProducts.map((product) => (
            <option key={product.slug} value={product.slug}>
              {product.name}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" size="sm">
        Save product grid
      </Button>
    </Form>
  );
}
