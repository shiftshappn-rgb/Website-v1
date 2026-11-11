import { useNavigate, useSearchParams } from "react-router";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export function SortSelect({ value }: { value: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "newest") params.delete("sort");
    else params.set("sort", next);
    const qs = params.toString();
    navigate(qs ? `?${qs}` : ".", { replace: true });
  }

  return (
    <label className="inline-flex w-full items-center gap-2 text-sm text-charcoal/70 sm:w-auto">
      <span className="shrink-0">Sort</span>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Sort products"
        className="max-w-[11rem] cursor-pointer truncate rounded-full border border-charcoal/15 bg-white px-3.5 py-2.5 text-sm text-charcoal transition-colors hover:border-navy/40 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20 sm:max-w-none"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
