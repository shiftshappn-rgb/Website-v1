import type { Route } from "./+types/faq";
import { Link } from "react-router";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "FAQ — shiftshappn",
    description: "Frequently asked questions about shiftshappn scrubs, shipping, returns, and sizing.",
    path: "/faq",
  });
}

const faqs = [
  {
    q: "What is your shipping policy?",
    a: "We offer free standard shipping on all orders over $100 CAD within Canada. Orders under $100 are shipped at a flat rate of $9.95. Most orders arrive within 3–7 business days.",
  },
  {
    q: "What is your return policy?",
    a: "We offer free 14-day returns on unworn items with original tags attached. Simply initiate a return from your account or contact our support team.",
  },
  {
    q: "How do I find my size?",
    a: "Visit our size chart page for detailed measurements. If you're between sizes, we generally recommend sizing up for a more relaxed fit.",
  },
  {
    q: "Are your scrubs antimicrobial?",
    a: "Select fabric lines include antimicrobial properties. Check individual product pages for fabric details, or browse our shop by fabric section.",
  },
  {
    q: "Do you ship internationally?",
    a: "Currently we ship within Canada only. We're working on expanding to the US — sign up for our newsletter to be notified.",
  },
  {
    q: "How do I care for my scrubs?",
    a: "Machine wash cold with like colours. Tumble dry low or hang to dry. Avoid bleach and fabric softener to preserve fabric performance.",
  },
];

export default function Faq({}: Route.ComponentProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-2">
        Frequently asked questions
      </h1>
      <p className="text-charcoal/70 mb-10">
        Can't find what you're looking for?{" "}
        <Link to="/contact" className="text-navy underline underline-offset-4 hover:text-terracotta">
          Contact us
        </Link>
        .
      </p>
      <div className="divide-y divide-charcoal/10">
        {faqs.map((faq) => (
          <details key={faq.q} className="group py-1">
            <summary className="flex cursor-pointer items-center justify-between py-4 font-medium text-charcoal list-none">
              {faq.q}
              <span className="ml-4 text-charcoal/50 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p className="pb-4 text-sm text-charcoal/80 leading-relaxed">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
