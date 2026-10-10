"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlan, useSaved } from "@/lib/client/hooks";
import type { TripPlan, TripTemplate } from "@/lib/domain/types";
import { resolveItinerary } from "@/lib/engine/resolve";
import { fmtRange, nok, plural } from "@/lib/format";
import type { StartingPrice } from "@/lib/pricing-preview";
import type { TripSummary } from "@/lib/summary";
import { DatesSheet } from "./DatesSheet";
import { IconBack, IconCheck, IconHeart, IconShield } from "./icons";
import { Timeline } from "./Timeline";
import { TripImage } from "./TripImage";
import { Badge, Button, ButtonLink, Section, StickyBar } from "./ui";

export function TripDetail({ template: t, summary, from, defaults }: { template: TripTemplate; summary: TripSummary; from: StartingPrice; defaults: TripPlan }) {
  const { plan, setPlan } = usePlan(defaults);
  const { saved, toggle } = useSaved();
  const [booking, setBooking] = useState(false);
  const itinerary = useMemo(() => resolveItinerary(t, plan), [t, plan]);
  const isSaved = saved.includes(t.slug);
  const customized =
    Object.keys(plan.stays).length + Object.keys(plan.choices).length + Object.keys(plan.flights).length + Object.keys(plan.activities).length > 0 ||
    plan.startDate !== defaults.startDate ||
    plan.travelers !== defaults.travelers;
  const route = [t.homeAirport === "OSL" ? "Oslo" : t.homeAirport, ...summary.destinations, ...(itinerary.openSegments.length ? ["?"] : []), "Oslo"];
  const incomplete = t.components.filter((c) => c.provenance === "incomplete").length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative">
        <TripImage scene={t.scene} photoUrl={t.photoUrl} alt={`${t.destination} — ${t.category}`} priority className="aspect-[4/4.2] sm:mt-6 sm:aspect-[16/9] sm:rounded-[28px]" />
        <div className="absolute inset-x-0 top-0 flex justify-between p-4">
          <Link href="/" aria-label="Back to discover" className="grid h-10 w-10 place-items-center rounded-full bg-paper/90 shadow-float backdrop-blur">
            <IconBack size={20} />
          </Link>
          <button
            type="button"
            onClick={() => toggle(t.slug)}
            aria-pressed={isSaved}
            aria-label={isSaved ? "Remove from saved" : "Save trip"}
            className="grid h-10 w-10 place-items-center rounded-full bg-paper/90 shadow-float backdrop-blur"
          >
            <IconHeart size={20} filled={isSaved} className={isSaved ? "text-accent" : ""} />
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6">
        <header className="pt-6">
          <h1 className="font-display text-[40px] font-semibold leading-none sm:text-[52px]">{t.destination}</h1>
          <p className="mt-2 text-[17px] text-ink-soft">{t.tags.join(" · ")}</p>
          <p className="mt-3 text-[15px] text-ink-mute">
            {plural(summary.nights, "night")} · {plural(summary.destinations.length, "destination")} · {t.travelStyle} ·{" "}
            {summary.reviewCount ? `★ ${summary.rating?.toFixed(1)} (${summary.reviewCount})` : "No reviews yet"}
          </p>
          <p className="mt-5 text-[17px] leading-relaxed">{t.summary}</p>
          <ul className="mt-5 space-y-2">
            {t.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-[15px] text-ink-soft">
                <IconCheck size={18} className="mt-0.5 shrink-0 text-ok" />
                {h}
              </li>
            ))}
          </ul>
          {incomplete > 0 && (
            <p className="mt-5 rounded-2xl bg-warn-soft px-4 py-3 text-[14px] text-warn">
              {plural(incomplete, "part")} of the original itinerary {incomplete === 1 ? "is" : "are"} still incomplete. They&apos;re marked below and never filled in silently.
            </p>
          )}
        </header>

        <Section title="Route">
          <div className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 text-[15px]">
            {route.map((r, i) => (
              <span key={`${r}-${i}`} className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 ${r === "?" ? "border border-dashed border-warn/60 text-warn" : "bg-paper ring-1 ring-line"}`}>{r === "?" ? "Open" : r}</span>
                {i < route.length - 1 && <span className="text-ink-mute">→</span>}
              </span>
            ))}
          </div>
        </Section>

        <Section
          title="Itinerary"
          id="itinerary"
          aside={<span className="text-sm text-ink-mute">{fmtRange(itinerary.startDate, itinerary.endDate)}</span>}
        >
          <p className="-mt-2 mb-5 text-sm text-ink-soft">
            {customized ? "Showing your dates and changes." : `Showing the creator's original dates (${fmtRange(t.originalStartDate, t.originalEndDate)}).`} Times are confirmed when you check availability.
          </p>
          <Timeline itinerary={itinerary} />
        </Section>

        <Section title="Estimated cost">
          <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
            <dl className="space-y-2 text-[15px]">
              {from.byCategory.map((c) => (
                <div key={c.category} className="flex justify-between">
                  <dt className="text-ink-soft">{c.category}</dt>
                  <dd className="tabular-nums">{nok(c.total)}</dd>
                </div>
              ))}
              <div className="flex justify-between">
                <dt className="text-ink-soft">Itinera service fee</dt>
                <dd className="tabular-nums">{nok(from.serviceFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 font-semibold">
                <dt>From, total for {plural(from.travelers, "traveller")}</dt>
                <dd className="tabular-nums">{nok(from.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[13px] text-ink-mute">
              Illustrative prices from simulated suppliers, using the cheapest choice for undecided parts. Taxes and fees included. Your exact price is calculated when you check availability.
            </p>
          </div>
        </Section>

        <Section title="About the creator">
          <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-sand font-display text-lg">{t.creator.name.slice(0, 1)}</span>
              <div>
                <p className="font-medium">{t.creator.name}</p>
                <Badge t={t.creator.status === "completed" ? "ok" : "neutral"}>{t.creator.status === "completed" ? "Personally completed" : "Planned itinerary"}</Badge>
              </div>
            </div>
            <p className="mt-3 text-[15px] text-ink-soft">{t.creator.bio}</p>
            <p className="mt-2 text-[13px] text-ink-mute">{t.creator.statusNote}</p>
          </div>
        </Section>

        <Section title="Reviews">
          <p className="text-[15px] text-ink-soft">
            No reviews yet. Only travellers who booked and completed this trip through Itinera can review it.
          </p>
        </Section>

        <div className="flex items-start gap-3 pb-6 text-[13px] text-ink-mute">
          <IconShield size={18} className="shrink-0" />
          Demo mode. No real reservations or payments are made. Package-travel protection and supplier terms apply before commercial launch.
        </div>
      </div>

      <StickyBar>
        <div className="mr-auto hidden min-w-0 sm:block">
          <p className="truncate text-sm text-ink-mute">From</p>
          <p className="font-semibold">{nok(from.perPerson)} <span className="font-normal text-ink-mute">pp</span></p>
        </div>
        <ButtonLink href={`/trips/${t.slug}/customize`} variant="secondary" className="flex-1 sm:flex-none" data-testid="customize">
          Customize
        </ButtonLink>
        <Button onClick={() => setBooking(true)} className="flex-[1.4] sm:flex-none" data-testid="book-trip">
          Book this trip
        </Button>
      </StickyBar>

      <DatesSheet open={booking} onClose={() => setBooking(false)} plan={plan} setPlan={setPlan} nights={itinerary.totalNights} />
    </div>
  );
}
