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
    <label className="inline-flex items-center gap-2 text-sm text-charcoal/70">
      <span className="sr-only sm:not-sr-only">Sort</span>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-charcoal/20 bg-white px-3 py-2 text-sm text-charcoal focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
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
