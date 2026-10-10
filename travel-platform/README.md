# Itinera — Phase 1 functional prototype

**Discover a trip. Make it yours. Book everything.**

A mobile-first, working prototype of a marketplace where complete itineraries become
reusable, customisable and bookable products. It ships with the founder's real
Philippines honeymoon (11 Dec 2026 – 3 Jan 2027) as the primary example and seven sample trips.

> **Demo mode.** All suppliers and payments are simulated. No reservation is made and no money moves.
> Prices are illustrative NOK and are labelled as such everywhere in the UI.

## Run it

Requires Node 20+.

```bash
cd travel-platform
npm install
npm run dev            # http://localhost:3000
```

Production build: `npm run build && npm start`.
Set `DEMO_LATENCY=off` to turn off the simulated supplier latency.

## Try the journeys

1. Open **Philippines · Honeymoon** → **Book this trip** → pick a date → **Check availability**.
2. Watch every component being searched. The engine then validates the whole journey.
3. Make the decisions it asks for: the original trip has **no Bangkok hotel** and **four open nights**.
   They are shown as incomplete, never invented.
4. Switch the **test scenario** in the dark demo bar to try failure paths:

| Scenario | What happens |
|---|---|
| Everything available | Clean path to confirmation |
| Resort room sold out *(default)* | Cauayan Beach Villa is sold out on 23–24 Dec. You get other rooms, comparable resorts, other dates and a re-allocation of nights, each with its price difference |
| Flight retimed, transfer impossible | The Coron → El Nido flight lands after the last boat. The resort is blocked as unreachable until you pick a flight that works |
| Supplier fails during booking | One transfer times out once (retried automatically); the houseboat declines. Payment stays authorised but not charged; replace it or cancel everything |
| Price changes before payment | The long-haul fare rises between search and payment; you must accept the new total |

Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined (any future expiry, any CVC).

## Test

```bash
npm test               # unit tests: dates/time zones, engine, alternatives, orchestration (24 tests)
npm run test:e2e       # Playwright, iPhone viewport: 6 full journeys incl. failure scenarios
npm run typecheck && npm run lint
```

The e2e config builds the app and serves it on port 3100. If you already have Chromium
installed for Playwright 1.56 this works out of the box; otherwise run `npx playwright install chromium` once.

## Where things are

```
src/lib/domain        Types (template, plan, quote, booking), dates & time zones, airports
src/lib/data/trips    Trip Template Service (Philippines + samples)
src/lib/engine        Itinerary orchestrator: resolve → search → validate → alternatives → price
src/lib/providers     Supplier adapter interfaces, mock adapters + inventory + scenarios, live adapter notes
src/lib/booking       Booking orchestrator (states, retries, idempotency, partial failure, cancellation)
src/lib/payments      Payment provider interface + simulated authorise/capture/void/refund
src/app/api           HTTP API: /availability (NDJSON stream), /quotes, /bookings
src/app, components   The UI
db/schema.sql         Target PostgreSQL schema
docs/ARCHITECTURE.md  Architecture, dependencies, what's simulated, deployment & roadmap
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the product architecture, commercial dependencies
and what it takes to go live.
