import type { Route } from "./+types/about";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "About — shiftshappn",
    description: "Learn about shiftshappn — premium Canadian medical scrubs designed for healthcare professionals.",
    path: "/about",
  });
}

export default function About({}: Route.ComponentProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-8">About shiftshappn</h1>
      <div className="prose-brand space-y-6">
        <p>
          shiftshappn was born from a simple belief: healthcare professionals deserve
          scrubs that work as hard as they do. Founded in Canada, we design premium
          medical apparel that combines comfort, durability, and style for every shift.
        </p>
        <h2>Our mission</h2>
        <p>
          We create scrubs that move with you — through long shifts, quick changes, and
          everything in between. Every piece is thoughtfully designed with four-way
          stretch fabrics, functional pockets, and a fit that flatters every body.
        </p>
        <h2>Made for Canadians</h2>
        <p>
          From our headquarters to your hospital, we're proud to serve healthcare
          professionals across Canada. Free shipping on orders over $100 CAD and
          hassle-free 14-day returns, because we stand behind every stitch.
        </p>
        <h2>Sustainability</h2>
        <p>
          We're committed to responsible manufacturing and packaging. Our fabrics are
          selected for longevity, reducing the need for frequent replacements and
          minimizing waste over time.
        </p>
      </div>
    </div>
  );
}
