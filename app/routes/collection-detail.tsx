import type { Route } from "./+types/collection-detail";
import { data } from "react-router";
import { ProductGrid } from "~/components/storefront/ProductCard";
import { loadCollectionPage } from "~/lib/catalog.server";
import { buildMeta } from "~/lib/seo";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.collection) {
    return [{ title: "Collection not found — shiftshappn" }];
  }
  const { collection } = loaderData;
  return buildMeta({
    title: collection.seoTitle ?? `${collection.name} — shiftshappn`,
    description: collection.seoDescription ?? collection.description ?? `Shop the ${collection.name} collection.`,
    path: `/collections/${collection.slug}`,
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  const page = params.slug ? await loadCollectionPage(params.slug) : null;
  if (!page) {
    throw data("Collection not found", { status: 404 });
  }
  return page;
}

export default function CollectionDetail({ loaderData }: Route.ComponentProps) {
  const { collection, products, cloudName } = loaderData;
  const cloud = cloudName ?? "demo";

  return (
    <div>
      {collection.heroImage && (
        <div className="aspect-[21/9] bg-sand overflow-hidden">
          <img
            src={
              collection.heroImage.startsWith("http")
                ? collection.heroImage
                : `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,w_1600/${collection.heroImage}`
            }
            alt={collection.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <header className="mb-8 lg:mb-12 text-center max-w-2xl mx-auto">
          <h1 className="text-3xl lg:text-4xl font-serif text-navy">{collection.name}</h1>
          {collection.description && (
            <p className="mt-4 text-charcoal/70">{collection.description}</p>
          )}
          <p className="mt-2 text-sm text-charcoal/50">{products.length} products</p>
        </header>

        <ProductGrid products={products} cloudName={cloudName} />
      </div>
    </div>
  );
}
