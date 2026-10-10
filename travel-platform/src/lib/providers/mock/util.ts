import type { NOK } from "../../domain/types";

/** Small deterministic hash so mock prices and latencies are stable across runs. */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic number in [0, 1). */
export function unit(input: string): number {
  return (hash(input) % 10_000) / 10_000;
}

/** Seasonal multiplier for the mock market (illustrative). */
export function seasonFactor(date: string): number {
  const md = date.slice(5);
  if (md >= "12-18" || md <= "01-05") return 1.32;
  if (md >= "12-01") return 1.12;
  if (md >= "07-01" && md <= "08-10") return 1.18;
  if (md >= "02-01" && md <= "03-15") return 1.1;
  return 1;
}

/** ±5% deterministic variation so different dates give different prices. */
export function jitter(key: string): number {
  return 0.95 + unit(key) * 0.1;
}

export function roundNok(n: number): NOK {
  return Math.round(n);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function latency(enabled: boolean, key: string, min: number, max: number) {
  if (!enabled) return;
  await sleep(min + unit(key) * (max - min));
}

/** Airlines typically open sales ~330 days ahead; beyond that we only have estimates. */
export const FLIGHT_SALES_WINDOW_DAYS = 330;
export const STAY_SALES_WINDOW_DAYS = 500;
