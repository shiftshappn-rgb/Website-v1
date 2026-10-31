import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Search, X } from "lucide-react";
import { cloudinaryImageUrl } from "~/lib/cloudinary";
import { formatCurrency } from "~/lib/utils";

type SearchResultItem = {
  id: string;
  name: string;
  href: string;
  price: number;
  imagePublicId: string | null;
  imageAlt: string;
  kind: "product" | "bundle" | "set";
};

const POPULAR_SEARCHES = [
  "scrubs",
  "scrub top",
  "scrub pant",
  "women",
  "men",
  "bundles",
  "accessories",
  "navy",
] as const;

type SearchDrawerProps = {
  open: boolean;
  onClose: () => void;
  cloudName?: string | null;
};

function highlightMatch(text: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${part}-${index}`} className="font-semibold text-charcoal">
        {part}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export function SearchDrawer({ open, onClose, cloudName = null }: SearchDrawerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setResults([]);
    setLoading(false);
    setSearched(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as { results?: SearchResultItem[] };
        setResults(payload.results ?? []);
        setSearched(true);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  const showPopular = query.trim().length === 0;
  const showEmpty = searched && !loading && results.length === 0 && query.trim().length > 0;

  return (
    <div
      className="animate-menu-in fixed inset-0 z-[110] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,237,227,0.55),transparent_42%)]" />

      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-charcoal/8 px-4 py-3 sm:px-8 lg:px-12">
        <Link
          to="/"
          onClick={onClose}
          className="font-sans text-lg font-extrabold uppercase tracking-tight text-navy sm:text-xl"
        >
          shiftshappn
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-sand hover:text-navy"
          aria-label="Close search"
        >
          <X size={22} strokeWidth={1.5} />
        </button>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-5 pb-12 pt-10 sm:px-8 sm:pt-14 lg:pt-16">
        <div className="relative">
          <label htmlFor={inputId} className="sr-only">
            Search products
          </label>
          <Search
            size={20}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-charcoal/35"
            aria-hidden
          />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full border-0 border-b border-charcoal/20 bg-transparent py-3.5 pl-9 pr-10 text-2xl font-medium tracking-tight text-charcoal placeholder:font-normal placeholder:text-charcoal/30 focus:border-navy focus:outline-none focus:ring-0 sm:py-4 sm:pl-10 sm:text-3xl"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-0 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center text-charcoal/40 transition-colors hover:text-navy"
              aria-label="Clear search"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        <div className="mt-10 flex-1" aria-live="polite">
          {loading ? (
            <p className="text-sm text-charcoal/45">Searching…</p>
          ) : null}

          {showEmpty ? (
            <div className="py-8 text-center sm:py-12">
              <p className="font-serif text-2xl text-navy">No results for “{query.trim()}”</p>
              <p className="mt-2 text-sm text-charcoal/55">
                Try another term, or browse the shop.
              </p>
              <Link
                to="/shop"
                onClick={onClose}
                className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-4 hover:underline"
              >
                Browse shop
              </Link>
            </div>
          ) : null}

          {results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
              {results.map((item, index) => {
                const src = item.imagePublicId
                  ? cloudinaryImageUrl(item.imagePublicId, cloudName, 240)
                  : null;

                return (
                  <li
                    key={`${item.kind}-${item.id}`}
                    className="animate-menu-link"
                    style={{ ["--stagger-delay" as string]: `${40 + index * 35}ms` }}
                  >
                    <Link
                      to={item.href}
                      onClick={onClose}
                      className="group flex gap-4 transition-opacity hover:opacity-90"
                    >
                      <div className="relative aspect-[3/4] w-[4.5rem] shrink-0 overflow-hidden bg-sand sm:w-24">
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            width={96}
                            height={128}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-full bg-sand" aria-hidden />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                        <p className="text-sm leading-snug text-charcoal/80 sm:text-[15px]">
                          {highlightMatch(item.name, query)}
                        </p>
                        <p className="mt-1.5 text-sm tabular-nums text-charcoal/55">
                          {item.price > 0 ? formatCurrency(item.price) : null}
                        </p>
                        {item.kind !== "product" ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy/45">
                            {item.kind === "bundle" ? "Bundle" : "Set"}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showPopular ? (
            <div className="mx-auto max-w-xs pt-6 text-center sm:pt-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal/40">
                Popular searches
              </p>
              <ul className="mt-5 space-y-3">
                {POPULAR_SEARCHES.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(term);
                        inputRef.current?.focus();
                      }}
                      className="text-base font-medium text-charcoal transition-colors hover:text-navy sm:text-lg"
                    >
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
