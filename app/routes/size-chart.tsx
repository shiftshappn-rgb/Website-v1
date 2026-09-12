import type { Route } from "./+types/size-chart";
import { SizeChartTables } from "~/components/storefront/SizeChartTables";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Size chart — shiftshappn",
    description:
      "Find your perfect fit with the shiftshappn size chart for men's and women's scrubs, including bust, waist, hip, top length, and jogger, straight, and tall inseams.",
    path: "/size-chart",
  });
}

export default function SizeChart({}: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="mb-2 font-serif text-3xl text-navy lg:text-4xl">Size chart</h1>
      <p className="mb-10 text-charcoal/70">
        All measurements are in inches. If you are between sizes, we recommend sizing up
        for a more relaxed fit. Inseams are the same across sizes and vary by pant style.
      </p>

      <SizeChartTables />

      <div className="prose-brand">
        <h2>How to measure</h2>
        <p>
          <strong>Bust/Chest:</strong> Measure around the fullest part of your chest, keeping
          the tape parallel to the floor.
        </p>
        <p>
          <strong>Waist:</strong> Measure around your natural waistline, the narrowest part
          of your torso.
        </p>
        <p>
          <strong>Hip:</strong> Measure around the fullest part of your hips, about 8 inches
          below your waist.
        </p>
        <p>
          <strong>Top length:</strong> Measure from the high point of the shoulder down to
          the hem.
        </p>
        <p>
          <strong>Inseam:</strong> Measure from the crotch to the hem. Jogger is cuffed,
          Straight is regular, and Tall is lengthened.
        </p>
      </div>
    </div>
  );
}
