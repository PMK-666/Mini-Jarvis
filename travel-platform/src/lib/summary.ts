import type { TripTemplate } from "./domain/types";
import { templateNights } from "./data/trips";

export interface TripSummary {
  slug: string;
  destination: string;
  category: string;
  categories: string[];
  tags: string[];
  travelStyle: TripTemplate["travelStyle"];
  scene: TripTemplate["scene"];
  photoUrl?: string;
  nights: number;
  destinations: string[];
  creatorStatus: TripTemplate["creator"]["status"];
  reviewCount: number;
  rating?: number;
  fromPerPerson?: number;
  fromTravelers?: number;
}

export function destinationsOf(t: TripTemplate): string[] {
  const cities: string[] = [];
  for (const c of t.components) if (c.kind === "stay" && !cities.includes(c.city)) cities.push(c.city);
  return cities;
}

export function summarize(t: TripTemplate, from?: { perPerson: number; travelers: number }): TripSummary {
  const ratings = t.reviews.filter((r) => r.verified).map((r) => r.rating);
  return {
    slug: t.slug,
    destination: t.destination,
    category: t.category,
    categories: t.categories,
    tags: t.tags,
    travelStyle: t.travelStyle,
    scene: t.scene,
    photoUrl: t.photoUrl,
    nights: templateNights(t),
    destinations: destinationsOf(t),
    creatorStatus: t.creator.status,
    reviewCount: ratings.length,
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
    fromPerPerson: from?.perPerson,
    fromTravelers: from?.travelers,
  };
}
