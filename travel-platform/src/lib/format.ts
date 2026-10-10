import type { NOK } from "./domain/types";

const nf = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export const nok = (n: NOK) => `NOK ${nf.format(Math.round(n)).replace(/\s/g, " ")}`;

export const signedNok = (n: NOK) => (n === 0 ? "Same price" : `${n > 0 ? "+" : "−"} ${nok(Math.abs(n))}`);

const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

export const fmtDay = (iso: string) =>
  d(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export const fmtShort = (iso: string) =>
  d(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const fmtLong = (iso: string) =>
  d(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function fmtRange(a: string, b: string): string {
  return `${fmtShort(a)} – ${fmtShort(b)} ${b.slice(0, 4)}`;
}

export const hm = (local?: string) => (local ? local.slice(11, 16) : "");

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
