"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useScenario } from "@/lib/client/hooks";
import { SCENARIOS } from "@/lib/providers/mock/scenarios";
import { IconCompass, IconFlask, IconHeart, IconSuitcase } from "./icons";
import { Button, Sheet } from "./ui";

const TABS = [
  { href: "/", label: "Discover", icon: IconCompass },
  { href: "/saved", label: "Saved", icon: IconHeart },
  { href: "/trips", label: "Trips", icon: IconSuitcase },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const showTabs = TABS.some((t) => t.href === path) || path === "/how-it-works";
  return (
    <>
      <DemoBar />
      <header className="sticky top-0 z-30 hidden border-b border-line/70 bg-canvas/90 backdrop-blur sm:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-display text-[22px] font-semibold">
            Itinera
          </Link>
          <nav className="flex items-center gap-1 text-[15px]" aria-label="Main">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-full px-4 py-2 transition-colors hover:bg-sand ${path === t.href ? "font-medium text-ink" : "text-ink-soft"}`}
                aria-current={path === t.href ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
            <Link href="/how-it-works" className={`rounded-full px-4 py-2 transition-colors hover:bg-sand ${path === "/how-it-works" ? "font-medium" : "text-ink-soft"}`}>
              How it works
            </Link>
          </nav>
        </div>
      </header>
      <main className={showTabs ? "pb-24 sm:pb-0" : ""}>{children}</main>
      {showTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur sm:hidden" aria-label="Tabs">
          <div className="mx-auto flex max-w-md justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
            {TABS.map((t) => {
              const active = path === t.href;
              const Icon = t.icon;
              return (
                <Link key={t.href} href={t.href} className={`flex w-20 flex-col items-center gap-0.5 text-[11px] ${active ? "text-ink" : "text-ink-mute"}`} aria-current={active ? "page" : undefined}>
                  <Icon size={24} strokeWidth={active ? 2 : 1.6} />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

function DemoBar() {
  const { scenario, setScenario } = useScenario();
  const [open, setOpen] = useState(false);
  const current = SCENARIOS.find((s) => s.id === scenario);
  return (
    <>
      <div className="bg-ink text-[12.5px] text-white/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
          <span className="truncate">
            <strong className="font-semibold text-white">Demo mode</strong> · simulated suppliers &amp; payments · nothing is booked
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/20"
            data-testid="scenario-button"
          >
            <IconFlask size={14} />
            <span className="max-w-[9rem] truncate sm:max-w-none">{current?.title ?? "Scenario"}</span>
          </button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Test scenario" footer={<Button className="w-full" onClick={() => setOpen(false)}>Done</Button>}>
        <p className="mb-4 text-[15px] text-ink-soft">
          Choose how the simulated suppliers behave on your next availability check. Use these to test the customer experience when things go wrong.
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Scenario">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={scenario === s.id}
              onClick={() => setScenario(s.id)}
              className={`w-full rounded-2xl p-4 text-left ring-1 transition ${scenario === s.id ? "ring-2 ring-ink" : "ring-line hover:bg-sand"}`}
              data-testid={`scenario-${s.id}`}
            >
              <div className="font-medium">{s.title}</div>
              <div className="mt-1 text-sm text-ink-soft">{s.description}</div>
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-mute">Payment tests: card 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined.</p>
      </Sheet>
    </>
  );
}
