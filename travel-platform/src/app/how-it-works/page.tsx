import Link from "next/link";
import { SCENARIOS } from "@/lib/providers/mock/scenarios";

const rows: [string, string, string][] = [
  ["Marketplace, trip pages, customization, checkout UI", "Working", "Production-quality structure; content is sample data"],
  ["Trip templates (day offsets, dependencies, provenance)", "Working", "Stored in code; moves to PostgreSQL (db/schema.sql)"],
  ["Itinerary engine: date shifting, validation, alternatives, pricing", "Working", "Real logic, unit-tested; runs against simulated inventory"],
  ["Supplier adapters (flights, stays, transfers, activities)", "Simulated", "Interfaces are final; live adapters are Phase 2"],
  ["Prices and availability", "Simulated", "Illustrative NOK prices; labelled in the UI"],
  ["Booking orchestration (states, retries, idempotency, partial failure, cancellation)", "Working", "In-memory; needs a durable store + job queue for production"],
  ["Payments (authorise → capture / void / refund)", "Simulated", "Hosted-field contract in place; swap for Stripe/Adyen test mode"],
  ["Saved trips and your bookings list", "Working", "Stored in this browser; accounts are Phase 3"],
  ["Creator publishing and earnings", "Not built", "Phase 4"],
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-[36px] font-semibold leading-tight">How Itinera works</h1>
      <p className="mt-3 text-[17px] text-ink-soft">
        Any complete itinerary becomes a reusable template. When you check availability, the engine rebuilds it for your dates, searches every
        supplier at once, checks that the whole journey connects, and prices it in one checkout.
      </p>

      <ol className="mt-8 space-y-4">
        {[
          ["Load the template", "Destinations, flights, stays, transfers and activities as day offsets with dependencies — never fixed dates."],
          ["Search inventory", "Independent searches run in parallel; transfers wait for the flights they meet."],
          ["Validate the journey", "Connections, boat operating hours, check-in dates, every night covered, time zones, total length."],
          ["Offer alternatives", "Other rooms, comparable stays, other dates or a different split of nights — with the price difference. Never a silent swap."],
          ["Price and book", "Itemised NOK total, re-checked before payment. Payment is captured only when every supplier confirms."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{i + 1}</span>
            <div>
              <p className="font-medium">{t}</p>
              <p className="text-[15px] text-ink-soft">{d}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 text-[22px] font-semibold">What&apos;s real in this prototype</h2>
      <div className="mt-4 overflow-hidden rounded-2xl bg-paper ring-1 ring-line">
        <table className="w-full text-left text-[14px]">
          <tbody className="divide-y divide-line">
            {rows.map(([a, b, c]) => (
              <tr key={a}>
                <td className="p-3 align-top">{a}</td>
                <td className="p-3 align-top font-medium">{b}</td>
                <td className="hidden p-3 align-top text-ink-soft sm:table-cell">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-[22px] font-semibold">Test scenarios</h2>
      <p className="mt-2 text-[15px] text-ink-soft">Switch scenario from the dark demo bar at the top of every page.</p>
      <ul className="mt-4 space-y-3">
        {SCENARIOS.map((s) => (
          <li key={s.id} className="rounded-2xl bg-paper p-4 ring-1 ring-line">
            <p className="font-medium">{s.title}</p>
            <p className="text-[14px] text-ink-soft">{s.description}</p>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-[15px]">
        Start with <Link href="/trips/philippines-honeymoon" className="font-medium underline underline-offset-4">the Philippines honeymoon</Link>.
      </p>
    </div>
  );
}
