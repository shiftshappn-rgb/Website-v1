import type { Route } from "./+types/policy-page";
import { data } from "react-router";
import { isDatabaseAvailable, tryDb } from "~/db.server";
import { buildMeta } from "~/lib/seo";

const POLICY_SLUGS = ["shipping", "returns", "privacy", "terms"] as const;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.policy) {
    return [{ title: "Policy — shiftshappn" }];
  }
  return buildMeta({
    title: `${loaderData.policy.title} — shiftshappn`,
    description: `${loaderData.policy.title} for shiftshappn.`,
    path: `/policies/${loaderData.policy.slug}`,
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!POLICY_SLUGS.includes(params.slug as (typeof POLICY_SLUGS)[number])) {
    throw data("Policy not found", { status: 404 });
  }

  if (!isDatabaseAvailable()) {
    throw data("Policy not found", { status: 404 });
  }

  const db = tryDb();
  if (!db) {
    throw data("Policy not found", { status: 404 });
  }

  const policy = await db.policyPage.findUnique({
    where: { slug: params.slug },
  });

  if (!policy) {
    throw data("Policy not found", { status: 404 });
  }

  return { policy };
}

export default function PolicyPage({ loaderData }: Route.ComponentProps) {
  const { policy } = loaderData;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-2">{policy.title}</h1>
      <p className="text-sm text-charcoal/50 mb-8">
        Last updated {new Date(policy.updatedAt).toLocaleDateString("en-CA")}
      </p>
      <div
        className="prose-brand"
        dangerouslySetInnerHTML={{ __html: policy.content }}
      />
    </div>
  );
}
