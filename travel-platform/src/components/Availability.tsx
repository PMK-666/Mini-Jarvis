"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlan, useScenario } from "@/lib/client/hooks";
import { useStored } from "@/lib/client/storage";
import type { Alternative, ComponentResult, Issue, PriceSummary, Quote, ResolvedItinerary, TripPlan, TripTemplate } from "@/lib/domain/types";
import type { EngineEvent } from "@/lib/engine";
import { applyPatch } from "@/lib/engine/patch";
import { fmtRange, nok, plural, signedNok } from "@/lib/format";
import { SCENARIOS } from "@/lib/providers/mock/scenarios";
import { IconAlert, IconBack, IconCheck, IconInfo } from "./icons";
import { componentIcon, Timeline } from "./Timeline";
import { Badge, Button, PriceSourceTag, Section, StickyBar } from "./ui";

type Phase = "idle" | "searching" | "validating" | "alternatives" | "pricing" | "done" | "error";

export function Availability({ template: t, defaults }: { template: TripTemplate; defaults: TripPlan }) {
  const router = useRouter();
  const { plan, setPlan, ready } = usePlan(defaults);
  const { scenario, ready: scenarioReady } = useScenario();
  const [changes, setChanges] = useStored<string[]>(`itinera.changes.${t.slug}`, []);
  const [phase, setPhase] = useState<Phase>("idle");
  const [itinerary, setItinerary] = useState<ResolvedItinerary | null>(null);
  const [searching, setSearching] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, ComponentResult>>(new Map());
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);
  const runId = useRef(0);
  const planKey = JSON.stringify(plan);

  useEffect(() => {
    if (!ready || !scenarioReady) return;
    const id = ++runId.current;
    const controller = new AbortController();
    const started = Date.now();
    setPhase("searching");
    setQuote(null);
    setError(null);
    setResults(new Map());
    setSearching(new Set());
    const timer = setInterval(() => setElapsed(Date.now() - started), 100);

    (async () => {
      try {
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, scenario }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "The availability check failed.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim() || id !== runId.current) continue;
            const e = JSON.parse(line) as EngineEvent;
            if (e.type === "plan") setItinerary(e.itinerary);
            if (e.type === "searching") setSearching((s) => new Set(s).add(e.id));
            if (e.type === "result") {
              setResults((m) => new Map(m).set(e.result.componentId, e.result));
              setSearching((s) => {
                const n = new Set(s);
                n.delete(e.result.componentId);
                return n;
              });
            }
            if (e.type === "phase") setPhase(e.phase);
            if (e.type === "quote") {
              setItinerary(e.quote.itinerary);
              setQuote(e.quote);
              setPhase("done");
            }
            if (e.type === "error") throw new Error(e.message);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError" || id !== runId.current) return;
        setError((err as Error).message);
        setPhase("error");
      } finally {
        clearInterval(timer);
        setApplying(null);
      }
    })();
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey, scenario, ready, scenarioReady]);

  const choose = (issue: Issue, alt: Alternative) => {
    setApplying(alt.id);
    setChanges((c) => [...c, `${issue.title} → ${alt.label}`]);
    setPlan(applyPatch(plan, alt.patch));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const blockers = quote?.issues.filter((i) => i.severity === "blocker") ?? [];
  const notes = quote?.issues.filter((i) => i.severity !== "blocker") ?? [];
  const included = itinerary?.components.filter((c) => c.included) ?? [];
  const resolvedCount = included.filter((c) => results.has(c.id)).length;
  const scenarioInfo = SCENARIOS.find((s) => s.id === scenario);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <div className="flex items-center gap-3 pt-4">
        <Link href={`/trips/${t.slug}/customize`} aria-label="Back to customize" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
          <IconBack size={20} />
        </Link>
        <div className="min-w-0">
          <p className="text-sm text-ink-mute">
            {plural(plan.travelers, "traveller")} · {itinerary ? fmtRange(itinerary.startDate, itinerary.endDate) : ""}
          </p>
          <h1 className="font-display text-[26px] font-semibold leading-tight">
            {t.destination} <span className="text-ink-mute">· {t.category}</span>
          </h1>
        </div>
      </div>

      {phase === "error" && (
        <div className="mt-8 rounded-2xl bg-bad-soft p-5 text-bad" role="alert">
          <p className="font-medium">We couldn&apos;t check this trip</p>
          <p className="mt-1 text-[15px]">{error}</p>
          <Link href={`/trips/${t.slug}/customize`} className="mt-3 inline-block font-medium underline underline-offset-4">
            Change dates or travellers
          </Link>
        </div>
      )}

      {phase !== "done" && phase !== "error" && (
        <section className="pt-8" aria-live="polite" aria-busy="true">
          <h2 className="text-[22px] font-semibold tracking-tight">
            {phase === "searching" ? "Rebuilding the trip for your dates" : phase === "validating" ? "Checking every connection" : phase === "alternatives" ? "Finding alternatives" : "Calculating your price"}
          </h2>
          <p className="mt-1 text-[15px] text-ink-soft">
            {applying ? "Applying your choice and re-checking everything. " : ""}
            Searching {plural(included.length || 1, "component")} across flight, hotel, transfer and experience suppliers · {(elapsed / 1000).toFixed(1)} s
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-ink transition-all duration-500"
              style={{ width: `${included.length ? Math.round(((resolvedCount + (phase !== "searching" ? 1 : 0)) / (included.length + 1)) * 100) : 4}%` }}
            />
          </div>
          <ul className="mt-6 divide-y divide-line rounded-2xl bg-paper ring-1 ring-line">
            {included.map((c) => {
              const r = results.get(c.id);
              const active = searching.has(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3" data-testid={`progress-${c.id}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand text-ink-soft">{componentIcon(c, 16)}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{c.title}</span>
                  <ProgressStatus result={r} active={active} />
                </li>
              );
            })}
          </ul>
          <ul className="mt-4 space-y-1 text-sm text-ink-soft">
            {(["validating", "alternatives", "pricing"] as const).map((p) => {
              const order = ["searching", "validating", "alternatives", "pricing", "done"];
              const state = order.indexOf(phase) > order.indexOf(p) ? "done" : phase === p ? "active" : "todo";
              return (
                <li key={p} className="flex items-center gap-2">
                  {state === "done" ? <IconCheck size={16} className="text-ok" /> : <span className={`ml-1 mr-1 h-2 w-2 rounded-full ${state === "active" ? "bg-ink animate-pulseDot" : "bg-line"}`} />}
                  {p === "validating" ? "Validate times, connections, transfers and nights" : p === "alternatives" ? "Prepare alternatives for anything unavailable" : "Itemised price in NOK"}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {phase === "done" && quote && (
        <>
          <section className="pt-8">
            {quote.bookable ? (
              <div className="flex items-start gap-3 rounded-2xl bg-ok-soft p-5 text-ok" data-testid="ready">
                <IconCheck size={22} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[17px] font-semibold">Your trip is ready to book</p>
                  <p className="text-[15px]">
                    Every component is available and the whole itinerary connects. Checked in {(quote.elapsedMs / 1000).toFixed(1)} s.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-warn-soft p-5 text-warn" data-testid="needs-attention">
                <IconAlert size={22} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-[17px] font-semibold">
                    {blockers.length === 1 ? "One thing needs your decision" : `${blockers.length} things need your decision`}
                  </p>
                  <p className="text-[15px]">We never replace part of your trip without asking. Choose an option below; everything is re-checked.</p>
                </div>
              </div>
            )}
            {scenarioInfo && <p className="mt-3 text-[13px] text-ink-mute">Test scenario: {scenarioInfo.title}</p>}
          </section>

          {blockers.length > 0 && (
            <Section title="Decisions">
              <div className="space-y-4">
                {blockers.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} onChoose={choose} applying={applying} />
                ))}
              </div>
            </Section>
          )}

          {changes.length > 0 && (
            <Section title="Changes you made" aside={<button type="button" className="text-sm text-ink-soft underline underline-offset-4" onClick={() => setChanges([])}>Clear list</button>}>
              <ul className="space-y-1.5 text-[15px] text-ink-soft">
                {changes.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <IconCheck size={16} className="mt-1 shrink-0 text-ok" />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Your itinerary">
            <Timeline itinerary={quote.itinerary} results={quote.results} hideExcluded showNotes={false} renderActions={(c) => <ResultLine result={quote.results.find((r) => r.componentId === c.id)} />} />
          </Section>

          {notes.length > 0 && (
            <Section title="Good to know">
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="flex gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
                    {n.severity === "warning" ? <IconAlert size={18} className="mt-0.5 shrink-0 text-warn" /> : <IconInfo size={18} className="mt-0.5 shrink-0 text-ink-mute" />}
                    <div>
                      <p className="font-medium">{n.title}</p>
                      <p className="text-[14px] text-ink-soft">{n.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Price">
            <PriceBreakdown pricing={quote.pricing} travelers={quote.plan.travelers} />
            <p className="mt-3 text-[13px] text-ink-mute">
              Prices held until {new Date(quote.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Every price is re-checked with the supplier before payment.
            </p>
          </Section>

          <StickyBar>
            <div className="mr-auto min-w-0">
              <p className="text-[13px] text-ink-mute">{quote.pricing.unpriced.length ? "Total so far" : "Total"}</p>
              <p className="font-semibold tabular-nums" data-testid="total">
                {nok(quote.pricing.total)}
              </p>
            </div>
            <Button disabled={!quote.bookable} onClick={() => router.push(`/checkout/${quote.id}`)} data-testid="to-checkout">
              {quote.bookable ? "Continue to checkout" : `${blockers.length} to resolve`}
            </Button>
          </StickyBar>
        </>
      )}
    </div>
  );
}

function ProgressStatus({ result, active }: { result?: ComponentResult; active: boolean }) {
  if (!result) {
    return active ? (
      <span className="flex items-center gap-2 text-sm text-ink-mute">
        <span className="h-2 w-2 rounded-full bg-ink animate-pulseDot" /> Searching
      </span>
    ) : (
      <span className="text-sm text-ink-mute">Waiting</span>
    );
  }
  switch (result.status) {
    case "available":
      return <Badge t="ok"><IconCheck size={13} /> {nok(result.offer!.price.total)}</Badge>;
    case "unavailable":
      return <Badge t="bad">Unavailable</Badge>;
    case "needs_selection":
      return <Badge t="warn">Choose</Badge>;
    case "error":
      return <Badge t="bad">Blocked</Badge>;
    default:
      return <Badge>Skipped</Badge>;
  }
}

function ResultLine({ result }: { result?: ComponentResult }) {
  if (!result) return null;
  if (result.status === "available" && result.offer) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
        <Badge t="ok"><IconCheck size={13} /> Available</Badge>
        <span className="tabular-nums">{nok(result.offer.price.total)}</span>
        <PriceSourceTag source={result.offer.price.source} />
        <span className="text-ink-mute">{result.offer.cancellation.refundable ? `Free cancellation until ${result.offer.cancellation.freeUntilDaysBefore} d before` : "Non-refundable"}</span>
      </div>
    );
  }
  if (result.status === "unavailable") return <div className="mt-2"><Badge t="bad">Unavailable</Badge> <span className="text-[13px] text-bad">{result.message}</span></div>;
  if (result.status === "needs_selection") return <div className="mt-2"><Badge t="warn">Choose a hotel</Badge></div>;
  if (result.status === "error") return <div className="mt-2"><Badge t="bad">Can&apos;t confirm</Badge> <span className="text-[13px] text-ink-soft">{result.message}</span></div>;
  return null;
}

function IssueCard({ issue, onChoose, applying }: { issue: Issue; onChoose: (i: Issue, a: Alternative) => void; applying: string | null }) {
  return (
    <article className="rounded-2xl bg-paper p-5 ring-1 ring-line" data-testid={`issue-${issue.rule}`}>
      <div className="flex gap-3">
        <IconAlert size={20} className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug">{issue.title}</h3>
          <p className="mt-1 text-[15px] text-ink-soft">{issue.detail}</p>
        </div>
      </div>
      {issue.alternatives && issue.alternatives.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {issue.alternatives.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={!!applying}
                onClick={() => onChoose(issue, a)}
                className="w-full rounded-xl bg-sand p-4 text-left transition hover:bg-line disabled:opacity-60"
                data-testid={`alt-${a.id}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-medium">{a.label}</span>
                  {a.priceDelta !== undefined && (
                    <span className={`shrink-0 text-sm tabular-nums ${a.priceDelta > 0 ? "text-ink" : "text-ok"}`}>{signedNok(a.priceDelta)}</span>
                  )}
                </span>
                <span className="mt-1 block text-[14px] text-ink-soft">{a.explanation}</span>
                {a.newTotal !== undefined && <span className="mt-1 block text-[13px] text-ink-mute">New total {nok(a.newTotal)}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-mute">No automatic alternatives found. Try other dates from the customize page.</p>
      )}
    </article>
  );
}

export function PriceBreakdown({ pricing, travelers }: { pricing: PriceSummary; travelers: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const sources = useMemo(() => new Set(pricing.lines.map((l) => l.price.source)), [pricing.lines]);
  return (
    <div className="rounded-2xl bg-paper p-5 ring-1 ring-line">
      <dl className="space-y-1 text-[15px]">
        {pricing.byCategory.map((c) => (
          <div key={c.category}>
            <button type="button" className="flex w-full justify-between py-1.5 text-left" onClick={() => setOpen(open === c.category ? null : c.category)} aria-expanded={open === c.category}>
              <dt className="text-ink-soft underline decoration-line underline-offset-4">{c.category}</dt>
              <dd className="tabular-nums">{nok(c.total)}</dd>
            </button>
            {open === c.category && (
              <ul className="mb-2 space-y-1 rounded-xl bg-sand p-3 text-[13px]">
                {pricing.lines
                  .filter((l) => l.category === c.category)
                  .map((l) => (
                    <li key={l.componentId} className="flex justify-between gap-3">
                      <span className="text-ink-soft">
                        {l.label} <span className="text-ink-mute">({l.price.basis})</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{nok(l.price.total)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}
        <div className="flex justify-between py-1.5 text-ink-mute">
          <dt>incl. taxes &amp; supplier fees</dt>
          <dd className="tabular-nums">{nok(pricing.taxesAndFees)}</dd>
        </div>
        <div className="flex justify-between py-1.5">
          <dt className="text-ink-soft">Itinera service fee ({Math.round(pricing.serviceFeeRate * 100)}%)</dt>
          <dd className="tabular-nums">{nok(pricing.serviceFee)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-[17px] font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{nok(pricing.total)}</dd>
        </div>
        <div className="flex justify-between text-sm text-ink-mute">
          <dt>Per person ({plural(travelers, "traveller")})</dt>
          <dd className="tabular-nums">{nok(pricing.perPerson)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...sources].map((s) => (
          <PriceSourceTag key={s} source={s} />
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-mute">
        {sources.has("live") ? "Live quotes come directly from suppliers. " : ""}
        {sources.has("simulated") ? "Illustrative prices come from simulated suppliers in demo mode. " : ""}
        {sources.has("estimate") ? "Estimates are not bookable until the supplier publishes prices. " : ""}
        {pricing.unpriced.length ? `${plural(pricing.unpriced.length, "component")} not yet priced.` : ""}
      </p>
    </div>
  );
}
