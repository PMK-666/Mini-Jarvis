# Live supplier adapters (Phase 2)

Nothing in this folder is active. It describes how real suppliers plug in.

Each adapter implements one interface from `../types.ts`:

| Interface          | Candidate suppliers (subject to commercial access)            | Notes |
|--------------------|----------------------------------------------------------------|-------|
| `FlightProvider`   | Duffel, Amadeus Self-Service / Enterprise                      | Duffel exposes search → offer → order with pay-later holds on some airlines. Amadeus Self-Service booking is limited; production ticketing generally needs an Enterprise agreement or a consolidator/IATA arrangement. |
| `StayProvider`     | Expedia Rapid, Booking.com Demand API, Hotelbeds, direct channel managers | Small resorts (houseboats, private islands) are often not in OTA APIs. Plan for a "manual confirmation" supplier type with email/WhatsApp confirmation tracked in the orchestrator. |
| `TransferProvider` | Local DMCs, Hoppa/Welcome Pickups-type APIs, ferry operators   | Boat transfers in Palawan are mostly arranged by the resort itself — model them as resort-provided add-ons. |
| `ActivityProvider` | Viator, GetYourGuide                                            | Both have partner APIs with booking; availability and cancellation rules differ per product. |

## Adding an adapter

1. Implement the interface (search + `revalidate`/`book`/`cancel`).
2. Map the supplier's offer into the shared `Offer` type. Set `price.source = "live"`.
3. Declare honest `capabilities` (e.g. `book: false` for request-only suppliers).
4. Pass the orchestrator's `idempotencyKey` through to the supplier (Duffel and most
   modern APIs accept one) or store it alongside the supplier reference.
5. Register it in `../registry.ts` behind `PROVIDER_MODE=live`.
6. Add contract tests that run the adapter against recorded supplier responses.

Secrets (API keys) go in environment variables only, never in the repository.
