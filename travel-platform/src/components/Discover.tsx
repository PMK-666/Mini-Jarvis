"use client";
import { useMemo, useState } from "react";
import type { TripSummary } from "@/lib/summary";
import { IconSearch, IconX } from "./icons";
import { TripCard } from "./TripCard";

export function Discover({ trips, categories }: { trips: TripSummary[]; categories: string[] }) {
  const [active, setActive] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter(
      (t) =>
        (active.length === 0 || active.some((c) => t.categories.includes(c))) &&
        (!q || [t.destination, t.category, ...t.tags, ...t.destinations].some((s) => s.toLowerCase().includes(q))),
    );
  }, [trips, active, query]);

  const toggle = (c: string) => setActive((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="pb-6 pt-8 sm:pt-14">
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent sm:hidden">Itinera</p>
        <h1 className="mt-1 font-display text-[34px] font-semibold leading-[1.08] sm:text-[52px]">
          Discover a trip.
          <br />
          Make it yours. Book everything.
        </h1>
        <p className="mt-3 max-w-xl text-[17px] text-ink-soft">
          Complete itineraries from real travellers — flights, stays, transfers and experiences — recreated for your dates in one checkout.
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-4 bg-canvas/95 px-4 pb-3 pt-2 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6">
        <label className="flex h-12 items-center gap-3 rounded-full bg-paper px-4 shadow-float ring-1 ring-line focus-within:ring-ink">
          <IconSearch size={18} className="text-ink-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations or styles"
            className="h-full flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-mute"
            aria-label="Search trips"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-ink-mute">
              <IconX size={18} />
            </button>
          )}
        </label>
        <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
          {categories.map((c) => {
            const on = active.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                aria-pressed={on}
                className={`h-9 shrink-0 rounded-full px-4 text-[14px] transition ${on ? "bg-ink text-white" : "bg-paper text-ink-soft ring-1 ring-line hover:text-ink"}`}
              >
                {c}
              </button>
            );
          })}
          {active.length > 0 && (
            <button type="button" onClick={() => setActive([])} className="h-9 shrink-0 px-3 text-[14px] text-ink-mute underline underline-offset-4">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-10 pb-16 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t, i) => (
          <TripCard key={t.slug} trip={t} priority={i < 2} />
        ))}
        {visible.length === 0 && (
          <div className="col-span-full py-16 text-center text-ink-soft">
            No trips match. <button className="underline underline-offset-4" onClick={() => { setActive([]); setQuery(""); }}>Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
