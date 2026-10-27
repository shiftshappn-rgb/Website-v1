import { useMemo, useState } from "react";
import { Form } from "react-router";
import { Button } from "~/components/ui/Button";
import { Input, Select, Textarea } from "~/components/ui/Input";
import type { PackShowcaseContent } from "~/components/homepage-blocks/types";

type CatalogPack = { slug: string; name: string };

export function PackShowcaseBlockEditor({
  blockId,
  content,
  catalogPacks,
}: {
  blockId: string;
  content: PackShowcaseContent;
  catalogPacks: CatalogPack[];
}) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(content.packSlugs ?? []);

  const availablePacks = useMemo(
    () => catalogPacks.filter((pack) => !selectedSlugs.includes(pack.slug)),
    [catalogPacks, selectedSlugs]
  );

  function addPack(slug: string) {
    if (!slug || selectedSlugs.includes(slug)) return;
    setSelectedSlugs((current) => [...current, slug]);
  }

  function removePack(slug: string) {
    setSelectedSlugs((current) => current.filter((item) => item !== slug));
  }

  function movePack(slug: string, direction: "up" | "down") {
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

  const packNameBySlug = useMemo(
    () => new Map(catalogPacks.map((pack) => [pack.slug, pack.name])),
    [catalogPacks]
  );

  return (
    <Form method="post" className="space-y-4 rounded-lg border border-charcoal/10 bg-stone/30 p-4">
      <input type="hidden" name="intent" value="updatePackShowcase" />
      <input type="hidden" name="id" value={blockId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Headline"
          name="headline"
          defaultValue={content.headline ?? "Bundles"}
          required
        />
        <Input
          label="View all label"
          name="ctaLabel"
          defaultValue={content.ctaLabel ?? "Shop bundles"}
        />
      </div>

      <Input
        label="View all link"
        name="ctaLink"
        defaultValue={content.ctaLink ?? "/shop/bundles"}
        placeholder="/shop/bundles"
      />

      <Textarea
        label="Body"
        name="body"
        defaultValue={content.body ?? ""}
        rows={2}
        className="min-h-[60px]"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-charcoal">Selected packs</p>
        {selectedSlugs.length === 0 ? (
          <p className="text-sm text-charcoal/60">
            No packs selected. Add active packs below. The homepage section stays hidden until at
            least one pack is selected.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedSlugs.map((slug, index) => (
              <li
                key={slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-charcoal/10 bg-white px-3 py-2"
              >
                <span className="text-sm text-charcoal">
                  {index + 1}. {packNameBySlug.get(slug) ?? slug}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-w-11"
                    disabled={index === 0}
                    onClick={() => movePack(slug, "up")}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-w-11"
                    disabled={index === selectedSlugs.length - 1}
                    onClick={() => movePack(slug, "down")}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11 text-red-600"
                    onClick={() => removePack(slug)}
                  >
                    Remove
                  </Button>
                </div>
                <input type="hidden" name="packSlugs" value={slug} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Add pack"
          defaultValue=""
          onChange={(event) => {
            addPack(event.target.value);
            event.target.value = "";
          }}
          className="min-w-[240px]"
        >
          <option value="">Choose a pack…</option>
          {availablePacks.map((pack) => (
            <option key={pack.slug} value={pack.slug}>
              {pack.name}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" size="sm">
        Save pack showcase
      </Button>
    </Form>
  );
}
