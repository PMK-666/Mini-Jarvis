import type { Place } from "./types";

/** Airports and transfer points used by the sample trips. */
export const PLACES: Record<string, Place> = {
  OSL: { code: "OSL", name: "Oslo Gardermoen", city: "Oslo", tz: "Europe/Oslo", country: "NO" },
  BKK: { code: "BKK", name: "Bangkok Suvarnabhumi", city: "Bangkok", tz: "Asia/Bangkok", country: "TH" },
  MNL: { code: "MNL", name: "Manila Ninoy Aquino", city: "Manila", tz: "Asia/Manila", country: "PH" },
  CEB: { code: "CEB", name: "Mactan–Cebu", city: "Cebu", tz: "Asia/Manila", country: "PH" },
  USU: { code: "USU", name: "Busuanga (Coron)", city: "Coron", tz: "Asia/Manila", country: "PH" },
  ENI: { code: "ENI", name: "El Nido Lio", city: "El Nido", tz: "Asia/Manila", country: "PH" },
  PMI: { code: "PMI", name: "Palma de Mallorca", city: "Palma", tz: "Europe/Madrid", country: "ES" },
  HND: { code: "HND", name: "Tokyo Haneda", city: "Tokyo", tz: "Asia/Tokyo", country: "JP" },
  KIX: { code: "KIX", name: "Osaka Kansai", city: "Osaka", tz: "Asia/Tokyo", country: "JP" },
  HEL: { code: "HEL", name: "Helsinki Vantaa", city: "Helsinki", tz: "Europe/Helsinki", country: "FI" },
  VCE: { code: "VCE", name: "Venice Marco Polo", city: "Venice", tz: "Europe/Rome", country: "IT" },
  FCO: { code: "FCO", name: "Rome Fiumicino", city: "Rome", tz: "Europe/Rome", country: "IT" },
  CNX: { code: "CNX", name: "Chiang Mai", city: "Chiang Mai", tz: "Asia/Bangkok", country: "TH" },
  KBV: { code: "KBV", name: "Krabi", city: "Krabi", tz: "Asia/Bangkok", country: "TH" },
  TOS: { code: "TOS", name: "Tromsø Langnes", city: "Tromsø", tz: "Europe/Oslo", country: "NO" },
  DOH: { code: "DOH", name: "Doha Hamad", city: "Doha", tz: "Asia/Qatar", country: "QA" },
  MLE: { code: "MLE", name: "Malé Velana", city: "Malé", tz: "Indian/Maldives", country: "MV" },
  ZRH: { code: "ZRH", name: "Zürich", city: "Zürich", tz: "Europe/Zurich", country: "CH" },
};

export function place(code: string): Place {
  const p = PLACES[code];
  if (!p) throw new Error(`Unknown place ${code}`);
  return p;
}

/** Same-country connections are treated as domestic for minimum connection times. */
export function isDomestic(a: string, b: string): boolean {
  return place(a).country === place(b).country;
}
