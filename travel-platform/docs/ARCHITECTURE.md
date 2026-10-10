# Itinera — architecture and path to production

## 1. Product model

| Concept | What it is | Mutable by customer? |
|---|---|---|
| **Trip template** | A creator's itinerary: ordered components with *day offsets*, dependencies and provenance | No (versioned) |
| **Trip plan** | A customer's customisation: departure date, travellers, cabin, hotel/room swaps, nights changes, optional extras, choices for open segments | Yes |
| **Quote** | The engine's priced, validated answer for a plan at a moment in time (30-min validity) | No |
| **Booking** | A purchase: one payment + one reservation per supplier component, each with its own state | Via actions only |

**Provenance** is a first-class field on every component: `booked` (creator booked it), `incomplete`
(missing in the original; shown as such), `assumed` (labelled placeholder so the trip can be searched)
and `suggested` (optional extra from Itinera). This is how the platform keeps the "never fabricate" rule enforceable in code.

## 2. Services (logical separation, one deployable today)

```
 Frontend (Next.js App Router, mobile-first)
   │  discovery · trip page · customize · availability · checkout · booking status
   ▼
 API routes (src/app/api)
   ├─ Trip Template Service ........ src/lib/data/trips      → Postgres trip_templates/*
   ├─ Itinerary Orchestrator ....... src/lib/engine          (resolve, validate, alternatives)
   ├─ Pricing & Availability ....... src/lib/engine/search+pricing → providers/*
   ├─ Booking Service .............. src/lib/booking         → reservations, events, idempotency
   ├─ Payments Service ............. src/lib/payments        → Stripe/Adyen
   └─ User & Creator Service ....... (browser storage now)   → users, creators, saved_trips, commissions
 Supplier adapters (src/lib/providers): FlightProvider · StayProvider · TransferProvider · ActivityProvider
```

Each box only talks to the next through typed interfaces, so any one of them can be split into its
own service later without changing the others.

## 3. The booking engine

`runAvailability(template, plan)`:

1. **Resolve** – apply the plan: absolute dates from day offsets; changing nights at one stay shifts
   everything after it; open-segment choices expand into concrete components.
2. **Search** – every component runs concurrently; dependent ones (transfers meeting a flight) wait
   only for their dependency. Progress is streamed to the browser as NDJSON.
3. **Validate** – blockers vs warnings:
   - flight connections (MCT on one ticket; 90/180-min rules for separate tickets; airport changes)
   - transfer operating windows (e.g. Palawan boats don't run after dark) → *"You can't reach X"*
   - every night covered exactly once (stay, overnight flight, or explicitly self-arranged); no overlaps
   - arrival vs check-in date, early arrivals, trip length, time-zone consistency (IANA zones, DST-safe)
   - prices that are only estimates (schedules not on sale) are not bookable
   - disclosure of anything the engine selected because the original didn't record it
4. **Alternatives** – for each blocker: another room, a comparable property, the nearest earlier/later
   departure that works, re-allocating nights with the neighbouring stay, or a different flight.
   Each alternative is *re-evaluated by the engine*; only ones that actually fix the problem are offered,
   with the exact price difference. Choosing one changes the plan and re-runs everything — nothing is
   ever replaced silently.
5. **Price** – itemised NOK by category, taxes & supplier fees, a 3 % service fee (assumption), per person,
   with each line tagged `simulated`, `live` or `estimate`.

Performance target: < 5 minutes; the prototype completes the ~20-component Philippines trip in ~3 s with
simulated supplier latency. With real suppliers, expect 5–30 s dominated by flight search.

## 4. Booking orchestration

```
revalidating → payment_authorizing → booking_components → confirmed
                      ↘ failed (declined; nothing booked)
                                        ↘ action_required (partial) → replacement → confirmed
                                                                   ↘ cancel → cancelled (void/refund)
```

- **Revalidation** of every offer right before payment; a changed total requires explicit acceptance.
- **Authorise first, capture last**: money is only captured once every reservation is confirmed.
- **Idempotency** at two levels: the checkout request (`Idempotency-Key` header) and each supplier call.
- **Retries** with exponential backoff for retryable errors only; non-retryable declines stop at once.
- **Partial bookings** are never displayed as confirmed. The customer chooses a replacement or cancels;
  cancellation cancels each confirmed reservation with its supplier and voids or refunds the payment.

Production hardening needed: persist state in Postgres in the same transaction as each state change,
run processing in a durable job queue (e.g. a worker reading an outbox table) instead of an in-process
promise, add supplier-confirmation webhooks/polling for suppliers that confirm asynchronously, and an
operations console for manual intervention.

## 5. What is simulated vs production-ready

| Area | Status |
|---|---|
| UI, navigation, customisation, checkout flow | **Working**, production structure |
| Domain model, date/time-zone handling, engine, validation, alternatives, pricing maths | **Working**, unit-tested |
| Booking state machine, retries, idempotency, replacement, cancellation | **Working** logic; **in-memory** storage |
| Supplier inventory, schedules, rates, room categories, availability | **Simulated** |
| Payment authorisation/capture | **Simulated**; card data never sent to server (hosted-field contract) |
| Accounts, saved trips, booking history | Browser storage only |
| Photography | Unsplash URLs with illustrated fallbacks — replace with licensed images |
| Creator publishing, commissions, reviews | Not built (Phase 4); reviews are empty by design |

### Assumptions (labelled in the app)
- TG955 times (13:20 → 06:15+1) and the Thai Airways return MNL→BKK→OSL are placeholders.
- Bangkok → Manila → Cebu, Cebu → Busuanga and Coron → El Nido flight numbers were not recorded;
  the engine picks equivalents and says so.
- Room categories (e.g. Cauayan *Beach Villa*) were not recorded and are assumed.
- Island transfers are assumed operators/timings with daylight windows.
- Service fee 3 %; NOK pricing without FX.

## 6. Technical and commercial dependencies

**Flights.** Duffel (search, orders, some holds, ancillaries) or Amadeus Enterprise / a consolidator.
Ticketing requires either the aggregator acting as merchant of record or IATA accreditation.
Small regional carriers (e.g. AirSWIFT, Cebgo) may not be bookable via any API → manual fulfilment path.

**Accommodation.** Expedia Rapid, Booking.com Demand API (by application), Hotelbeds. Boutique resorts
and houseboats (Paolyn, Cauayan) are often absent → direct contracts + a *manual confirmation* supplier type.

**Transfers & activities.** Viator and GetYourGuide partner APIs for experiences; local DMCs for Palawan
boats, often bundled by the resort.

**Payments.** Stripe or Adyen with hosted fields/Payment Element (PCI scope SAQ-A), manual capture,
partial captures/refunds, Vipps MobilePay for Norway. Marketplace payouts to creators via Stripe Connect.

**Regulation (must be resolved before commercial sales).**
- Selling combined flight + accommodation is very likely a **package** or **linked travel arrangement**
  under the EU Package Travel Directive (2015/2302) as implemented in Norway by *pakkereiseloven*.
  This brings organiser liability for the whole trip, information duties, and **insolvency protection**.
- In Norway, package organisers must provide security to the **Reisegarantifondet** (Travel Guarantee Fund).
- Consumer rights for flights (EU261 where applicable), GDPR for traveller data (passport details),
  and Norwegian consumer marketing rules for price display (all-in prices).
Obtain legal advice; this document is not legal advice.

## 7. Deployment

The prototype is one Next.js app. Because state is in memory, run **one instance** (e.g. a single
container on Fly.io/Railway/Render, or `npm start` on a VM). Serverless platforms such as Vercel will
run it, but quotes and bookings will not survive between function instances — fine for click-through
demos, not for shared testing.

For Phase 2: managed Postgres (Supabase/Neon/RDS) using `db/schema.sql`, a worker process for booking
jobs, secrets in the platform's secret store (`DUFFEL_TOKEN`, `STRIPE_SECRET_KEY`, …), and
`PROVIDER_MODE=live` once adapters exist.

## 8. Roadmap

1. **Phase 1 (this)** – marketplace, Philippines template, customise, simulated engine, checkout. ✅
2. **Phase 2** – Duffel flight adapter + one hotel API in test mode; Postgres; Stripe test mode; contract tests.
3. **Phase 3** – commercial agreements, package-travel compliance & guarantee, live payments, durable
   orchestration, supplier confirmation tracking, customer support tooling, accounts.
4. **Phase 4** – creators publish trips, profiles, verified reviews, commissions.
