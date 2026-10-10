/**
 * SIMULATED SUPPLIER INVENTORY — demo mode only.
 *
 * Every schedule, room category, rate and policy below is illustrative. Property names
 * refer to real places so the prototype feels concrete, but the rates, room categories and
 * availability are invented for testing and must never be shown as real offers.
 * Flight numbers marked `assumedSchedule` are placeholders where the original trip did not
 * record exact times; they must be verified against a live supplier.
 */
import type { Cabin, NOK } from "../../domain/types";

export interface ScheduledFlight {
  flightNo: string;
  carrier: string;
  from: string;
  to: string;
  dep: string; // local HH:MM
  arr: string; // local HH:MM
  arrDayOffset: number;
  fares: Record<Cabin, NOK>; // per person one-way, before taxes
  taxRate: number;
  /** Times are an assumption, not taken from the original booking. */
  assumedSchedule?: boolean;
  refundable?: boolean;
}

const f = (
  flightNo: string,
  carrier: string,
  from: string,
  to: string,
  dep: string,
  arr: string,
  arrDayOffset: number,
  economy: NOK,
  extra: Partial<ScheduledFlight> = {},
): ScheduledFlight => ({
  flightNo,
  carrier,
  from,
  to,
  dep,
  arr,
  arrDayOffset,
  fares: { economy, premium: Math.round(economy * 1.75), business: Math.round(economy * 4.1) },
  taxRate: 0.14,
  ...extra,
});

export const FLIGHTS: ScheduledFlight[] = [
  // Philippines honeymoon
  f("TG955", "Thai Airways", "OSL", "BKK", "13:20", "06:15", 1, 6900, { assumedSchedule: true }),
  f("PR731", "Philippine Airlines", "BKK", "MNL", "09:25", "13:55", 0, 2100),
  f("5J930", "Cebu Pacific", "BKK", "MNL", "17:35", "22:05", 0, 1450),
  f("PR2849", "Philippine Airlines", "MNL", "CEB", "16:10", "17:35", 0, 950),
  f("5J565", "Cebu Pacific", "MNL", "CEB", "19:00", "20:20", 0, 690),
  f("DG6077", "Cebgo", "CEB", "USU", "10:05", "11:25", 0, 1290),
  f("T6402", "AirSWIFT", "USU", "ENI", "12:10", "13:10", 0, 3600, { assumedSchedule: true }),
  f("T6404", "AirSWIFT", "USU", "ENI", "08:30", "09:30", 0, 3950),
  f("T6286", "AirSWIFT", "ENI", "MNL", "10:30", "11:45", 0, 3900),
  f("T6288", "AirSWIFT", "ENI", "MNL", "14:40", "15:55", 0, 3700),
  f("TG621", "Thai Airways", "MNL", "BKK", "19:40", "22:20", 0, 2400, { assumedSchedule: true }),
  f("TG954", "Thai Airways", "BKK", "OSL", "00:05", "06:35", 0, 6900, { assumedSchedule: true }),
  // Mallorca charter
  f("6B841", "TUI fly Nordic", "OSL", "PMI", "07:10", "10:55", 0, 2150),
  f("6B842", "TUI fly Nordic", "PMI", "OSL", "11:55", "15:50", 0, 2150),
  // Japan
  f("AY912", "Finnair", "OSL", "HEL", "07:40", "10:25", 0, 1200),
  f("AY61", "Finnair", "HEL", "HND", "17:25", "13:40", 1, 5900),
  f("AY78", "Finnair", "KIX", "HEL", "10:55", "15:55", 0, 5900),
  f("AY917", "Finnair", "HEL", "OSL", "20:05", "20:55", 0, 1200),
  // Italy
  f("DY1872", "Norwegian", "OSL", "VCE", "10:15", "13:00", 0, 1350),
  f("DY1883", "Norwegian", "FCO", "OSL", "16:40", "20:05", 0, 1450),
  // Thailand backpacking
  f("FD3433", "Thai AirAsia", "BKK", "CNX", "11:15", "12:30", 0, 520),
  f("FD3242", "Thai AirAsia", "CNX", "KBV", "13:45", "15:50", 0, 640),
  f("TG252", "Thai Airways", "KBV", "BKK", "18:20", "19:35", 0, 980),
  // Norway family
  f("DY360", "Norwegian", "OSL", "TOS", "09:00", "10:50", 0, 990),
  f("DY371", "Norwegian", "TOS", "OSL", "16:20", "18:10", 0, 990),
  // Maldives
  f("QR176", "Qatar Airways", "OSL", "DOH", "16:10", "23:55", 0, 4200),
  f("QR672", "Qatar Airways", "DOH", "MLE", "02:05", "08:15", 0, 3100),
  f("QR673", "Qatar Airways", "MLE", "DOH", "09:45", "12:10", 0, 3100),
  f("QR175", "Qatar Airways", "DOH", "OSL", "16:00", "20:35", 0, 4200),
  // Switzerland
  f("LX1219", "Swiss", "OSL", "ZRH", "12:05", "14:30", 0, 1650),
  f("LX1222", "Swiss", "ZRH", "OSL", "16:40", "19:05", 0, 1650),
];

export interface RoomType {
  id: string;
  name: string;
  sleeps: number;
  rate: NOK; // per room per night, before taxes, shoulder season
  board: string;
  /** Rooms of this type the mock supplier holds per night. */
  inventory: number;
  freeCancelDays?: number; // undefined = non-refundable
}

export interface Property {
  id: string;
  name: string;
  city: string;
  area: string;
  tz: string;
  tier: "Luxury" | "Upscale" | "Comfort" | "Budget";
  comparableGroup: string;
  description: string;
  checkIn: string;
  checkOut: string;
  taxRate: number;
  rooms: RoomType[];
  /** Room categories are illustrative; verify against the supplier's catalogue. */
  illustrativeRooms: true;
}

const room = (
  id: string,
  name: string,
  rate: NOK,
  extra: Partial<RoomType> = {},
): RoomType => ({ id, name, rate, sleeps: 2, board: "Breakfast included", inventory: 6, freeCancelDays: 14, ...extra });

export const PROPERTIES: Property[] = [
  // Bangkok — not chosen in the original trip; offered as options.
  {
    id: "mandarin-oriental-bkk", name: "Mandarin Oriental, Bangkok", city: "Bangkok", area: "Riverside",
    tz: "Asia/Bangkok", tier: "Luxury", comparableGroup: "bkk-luxury", checkIn: "14:00", checkOut: "12:00", taxRate: 0.177,
    description: "Historic riverside hotel on the Chao Phraya.",
    rooms: [room("deluxe", "Deluxe Room", 5200), room("river-suite", "River View Suite", 9800)], illustrativeRooms: true,
  },
  {
    id: "kimpton-maa-lai", name: "Kimpton Maa-Lai Bangkok", city: "Bangkok", area: "Lumphini",
    tz: "Asia/Bangkok", tier: "Upscale", comparableGroup: "bkk-luxury", checkIn: "15:00", checkOut: "12:00", taxRate: 0.177,
    description: "Contemporary hotel next to Lumphini Park.",
    rooms: [room("king", "Premier King", 2900), room("studio", "Studio Suite", 4300)], illustrativeRooms: true,
  },
  {
    id: "ibis-styles-khaosan", name: "ibis Styles Bangkok Khaosan Viengtai", city: "Bangkok", area: "Old Town",
    tz: "Asia/Bangkok", tier: "Budget", comparableGroup: "bkk-budget", checkIn: "14:00", checkOut: "12:00", taxRate: 0.177,
    description: "Simple, central and walkable to the Grand Palace.",
    rooms: [room("standard", "Standard Double", 850, { freeCancelDays: 2 })], illustrativeRooms: true,
  },
  // Cebu
  {
    id: "waterfront-airport-cebu", name: "Waterfront Airport Hotel and Casino", city: "Cebu", area: "Mactan, opposite the airport",
    tz: "Asia/Manila", tier: "Comfort", comparableGroup: "ceb-airport", checkIn: "14:00", checkOut: "12:00", taxRate: 0.12,
    description: "Practical overnight stop directly across from Mactan–Cebu airport.",
    rooms: [room("deluxe", "Deluxe Room", 1250), room("executive", "Executive Suite", 2400)], illustrativeRooms: true,
  },
  {
    id: "bai-hotel-cebu", name: "Bai Hotel Cebu", city: "Cebu", area: "Mandaue",
    tz: "Asia/Manila", tier: "Upscale", comparableGroup: "ceb-airport", checkIn: "14:00", checkOut: "12:00", taxRate: 0.12,
    description: "Larger hotel about 25 minutes from the airport.",
    rooms: [room("deluxe", "Deluxe King", 1450)], illustrativeRooms: true,
  },
  // Coron
  {
    id: "paolyn-houseboats", name: "Paolyn Houseboats", city: "Coron", area: "Coron Bay",
    tz: "Asia/Manila", tier: "Upscale", comparableGroup: "coron-unique", checkIn: "13:00", checkOut: "10:00", taxRate: 0.12,
    description: "Traditional houseboats moored in Coron Bay, meals and island excursions included.",
    rooms: [room("cabin", "Houseboat Cabin", 4600, { board: "Full board", inventory: 3, freeCancelDays: 30 })],
    illustrativeRooms: true,
  },
  {
    id: "two-seasons-coron", name: "Two Seasons Coron Island Resort", city: "Coron", area: "Malcapuya area",
    tz: "Asia/Manila", tier: "Luxury", comparableGroup: "coron-resort", checkIn: "14:00", checkOut: "11:00", taxRate: 0.12,
    description: "Private-island resort with a house reef, reached by boat.",
    rooms: [
      room("beach-front", "Beachfront Suite", 6900, { board: "Full board", freeCancelDays: 30 }),
      room("bay-view", "Bay View Suite", 5600, { board: "Full board", freeCancelDays: 30 }),
    ],
    illustrativeRooms: true,
  },
  {
    id: "huma-island", name: "Huma Island Resort", city: "Coron", area: "Dimaky Island",
    tz: "Asia/Manila", tier: "Luxury", comparableGroup: "coron-resort", checkIn: "14:00", checkOut: "11:00", taxRate: 0.12,
    description: "Overwater villas on a private island north of Busuanga.",
    rooms: [room("overwater", "Overwater Villa", 8400, { board: "Full board", freeCancelDays: 30 })],
    illustrativeRooms: true,
  },
  {
    id: "club-paradise", name: "Club Paradise Palawan", city: "Coron", area: "Dimakya Island",
    tz: "Asia/Manila", tier: "Upscale", comparableGroup: "coron-resort", checkIn: "14:00", checkOut: "11:00", taxRate: 0.12,
    description: "Island resort known for dugong sightings on the house reef.",
    rooms: [room("sea-view", "Sea View Cottage", 4900, { board: "Full board", freeCancelDays: 21 })],
    illustrativeRooms: true,
  },
  // El Nido
  {
    id: "cauayan", name: "Cauayan Island Resort", city: "El Nido", area: "Cauayan Island",
    tz: "Asia/Manila", tier: "Luxury", comparableGroup: "elnido-island", checkIn: "14:00", checkOut: "11:00", taxRate: 0.12,
    description: "Small private-island resort about 45 minutes by boat from El Nido.",
    rooms: [
      room("beach-villa", "Beach Villa", 7400, { board: "Full board", inventory: 4, freeCancelDays: 30 }),
      room("hillside-villa", "Hillside Villa", 6300, { board: "Full board", inventory: 4, freeCancelDays: 30 }),
      room("pool-villa", "Pool Villa", 10900, { board: "Full board", inventory: 2, freeCancelDays: 45 }),
    ],
    illustrativeRooms: true,
  },
  {
    id: "lagen-island", name: "El Nido Resorts Lagen Island", city: "El Nido", area: "Lagen Island",
    tz: "Asia/Manila", tier: "Luxury", comparableGroup: "elnido-island", checkIn: "14:00", checkOut: "11:00", taxRate: 0.12,
    description: "Forest-and-lagoon resort in Bacuit Bay.",
    rooms: [room("forest", "Forest Room", 6900, { board: "Full board", freeCancelDays: 30 }), room("water", "Water Cottage", 8800, { board: "Full board", freeCancelDays: 30 })],
    illustrativeRooms: true,
  },
  {
    id: "pangulasian", name: "El Nido Resorts Pangulasian Island", city: "El Nido", area: "Pangulasian Island",
    tz: "Asia/Manila", tier: "Luxury", comparableGroup: "elnido-island", checkIn: "14:00", checkOut: "11:00", taxRate: 0.12,
    description: "Long white beach and canopy villas at the edge of Bacuit Bay.",
    rooms: [room("canopy", "Canopy Villa", 9600, { board: "Full board", freeCancelDays: 30 })],
    illustrativeRooms: true,
  },
  // Manila
  {
    id: "raffles-makati", name: "Raffles Makati", city: "Manila", area: "Makati",
    tz: "Asia/Manila", tier: "Luxury", comparableGroup: "mnl-luxury", checkIn: "15:00", checkOut: "12:00", taxRate: 0.12,
    description: "Calm suites in the heart of Makati.",
    rooms: [room("suite", "Raffles Suite", 3900)], illustrativeRooms: true,
  },
  {
    id: "ascott-bgc", name: "Ascott Bonifacio Global City", city: "Manila", area: "BGC",
    tz: "Asia/Manila", tier: "Comfort", comparableGroup: "mnl-luxury", checkIn: "15:00", checkOut: "12:00", taxRate: 0.12,
    description: "Serviced apartments in walkable BGC.",
    rooms: [room("one-bed", "One-Bedroom Apartment", 1900)], illustrativeRooms: true,
  },
  // Mallorca
  {
    id: "hipotels-cala-millor", name: "Hipotels Cala Millor Park", city: "Cala Millor", area: "Cala Millor beach",
    tz: "Europe/Madrid", tier: "Comfort", comparableGroup: "pmi-beach", checkIn: "15:00", checkOut: "11:00", taxRate: 0.1,
    description: "Family-friendly beach hotel on Mallorca's east coast.",
    rooms: [room("double", "Double Room", 1450, { board: "Half board" }), room("family", "Family Suite", 2350, { sleeps: 4, board: "Half board" })],
    illustrativeRooms: true,
  },
  {
    id: "zafiro-palace-alcudia", name: "Zafiro Palace Alcudia", city: "Alcúdia", area: "Playa de Muro",
    tz: "Europe/Madrid", tier: "Upscale", comparableGroup: "pmi-beach", checkIn: "15:00", checkOut: "11:00", taxRate: 0.1,
    description: "All-suite resort near the long beaches of the north coast.",
    rooms: [room("junior", "Junior Suite", 2600, { board: "All inclusive" })], illustrativeRooms: true,
  },
  // Japan
  {
    id: "hoshinoya-tokyo", name: "Hoshinoya Tokyo", city: "Tokyo", area: "Otemachi",
    tz: "Asia/Tokyo", tier: "Luxury", comparableGroup: "tyo", checkIn: "15:00", checkOut: "12:00", taxRate: 0.1,
    description: "A ryokan tower in the business district.",
    rooms: [room("kiku", "Kiku Room", 9200)], illustrativeRooms: true,
  },
  {
    id: "sequence-miyashita", name: "sequence MIYASHITA PARK", city: "Tokyo", area: "Shibuya",
    tz: "Asia/Tokyo", tier: "Comfort", comparableGroup: "tyo", checkIn: "17:00", checkOut: "11:00", taxRate: 0.1,
    description: "Design hotel above a rooftop park in Shibuya.",
    rooms: [room("standard", "Standard Double", 1900, { board: "Room only" })], illustrativeRooms: true,
  },
  {
    id: "kyoto-machiya", name: "Kyoto Machiya Townhouse", city: "Kyoto", area: "Gion",
    tz: "Asia/Tokyo", tier: "Comfort", comparableGroup: "kyo", checkIn: "16:00", checkOut: "10:00", taxRate: 0.1,
    description: "Restored wooden townhouse in a quiet lane.",
    rooms: [room("house", "Whole Townhouse", 2700, { sleeps: 4, board: "Room only", inventory: 1 })], illustrativeRooms: true,
  },
  {
    id: "cross-hotel-osaka", name: "Cross Hotel Osaka", city: "Osaka", area: "Dotonbori",
    tz: "Asia/Tokyo", tier: "Comfort", comparableGroup: "osa", checkIn: "15:00", checkOut: "11:00", taxRate: 0.1,
    description: "Central base for Osaka's food streets.",
    rooms: [room("double", "Standard Double", 1500, { board: "Room only" })], illustrativeRooms: true,
  },
  // Italy
  {
    id: "ca-maria-adele", name: "Ca Maria Adele", city: "Venice", area: "Dorsoduro",
    tz: "Europe/Rome", tier: "Upscale", comparableGroup: "vce", checkIn: "14:00", checkOut: "11:00", taxRate: 0.1,
    description: "Small palazzo facing the Salute church.",
    rooms: [room("deluxe", "Deluxe Double", 3600)], illustrativeRooms: true,
  },
  {
    id: "villa-cora", name: "Villa Cora", city: "Florence", area: "Oltrarno hills",
    tz: "Europe/Rome", tier: "Luxury", comparableGroup: "flr", checkIn: "15:00", checkOut: "11:00", taxRate: 0.1,
    description: "19th-century villa with gardens above the city.",
    rooms: [room("classic", "Classic Room", 4200)], illustrativeRooms: true,
  },
  // Thailand backpacking
  {
    id: "lub-d-silom", name: "Lub d Bangkok Silom", city: "Bangkok", area: "Silom",
    tz: "Asia/Bangkok", tier: "Budget", comparableGroup: "bkk-budget", checkIn: "14:00", checkOut: "12:00", taxRate: 0.177,
    description: "Social hostel with private rooms.",
    rooms: [room("private", "Private Double", 520, { board: "Room only", freeCancelDays: 2 })], illustrativeRooms: true,
  },
  {
    id: "stamps-backpackers", name: "Stamps Backpackers", city: "Chiang Mai", area: "Old City",
    tz: "Asia/Bangkok", tier: "Budget", comparableGroup: "cnx", checkIn: "14:00", checkOut: "12:00", taxRate: 0.177,
    description: "Friendly hostel in the old city.",
    rooms: [room("private", "Private Double", 380, { board: "Room only", freeCancelDays: 2 })], illustrativeRooms: true,
  },
  {
    id: "railay-garden-view", name: "Railay Garden View Resort", city: "Krabi", area: "Railay",
    tz: "Asia/Bangkok", tier: "Budget", comparableGroup: "kbv", checkIn: "14:00", checkOut: "11:00", taxRate: 0.177,
    description: "Simple bungalows a short walk from Railay's beaches.",
    rooms: [room("bungalow", "Garden Bungalow", 690, { board: "Room only", freeCancelDays: 3 })], illustrativeRooms: true,
  },
  // Norway
  {
    id: "scandic-ishavshotel", name: "Scandic Ishavshotel", city: "Tromsø", area: "Harbour",
    tz: "Europe/Oslo", tier: "Comfort", comparableGroup: "tos", checkIn: "15:00", checkOut: "12:00", taxRate: 0.12,
    description: "Harbourside hotel shaped like a ship.",
    rooms: [room("family", "Family Room", 2300, { sleeps: 4 })], illustrativeRooms: true,
  },
  {
    id: "lyngen-lodge", name: "Lyngen Lodge", city: "Lyngen", area: "Djupvik",
    tz: "Europe/Oslo", tier: "Upscale", comparableGroup: "lyngen", checkIn: "15:00", checkOut: "11:00", taxRate: 0.12,
    description: "Fjord-side lodge facing the Lyngen Alps.",
    rooms: [room("fjord", "Fjord View Room", 3400, { sleeps: 3, board: "Full board" })], illustrativeRooms: true,
  },
  // Maldives
  {
    id: "soneva-jani", name: "Soneva Jani", city: "Noonu Atoll", area: "Medhufaru",
    tz: "Indian/Maldives", tier: "Luxury", comparableGroup: "mle", checkIn: "14:00", checkOut: "12:00", taxRate: 0.27,
    description: "Overwater villas around a vast lagoon.",
    rooms: [room("water-retreat", "Water Retreat", 21000, { board: "Half board", freeCancelDays: 45 })], illustrativeRooms: true,
  },
  {
    id: "baros", name: "Baros Maldives", city: "North Malé Atoll", area: "Baros",
    tz: "Indian/Maldives", tier: "Luxury", comparableGroup: "mle", checkIn: "14:00", checkOut: "12:00", taxRate: 0.27,
    description: "Classic island resort close to Malé.",
    rooms: [room("water-villa", "Water Villa", 11500, { board: "Half board", freeCancelDays: 30 })], illustrativeRooms: true,
  },
  // Switzerland
  {
    id: "cervo-zermatt", name: "CERVO Mountain Resort", city: "Zermatt", area: "Riedweg",
    tz: "Europe/Zurich", tier: "Upscale", comparableGroup: "zermatt", checkIn: "15:00", checkOut: "11:00", taxRate: 0.08,
    description: "Chalet resort with Matterhorn views, ski-in by the Sunnegga piste.",
    rooms: [room("superior", "Superior Room", 5200, { board: "Half board", freeCancelDays: 21 })], illustrativeRooms: true,
  },
];

export interface TransferProduct {
  id: string;
  name: string;
  mode: "Private car" | "Private van" | "Speedboat" | "Boat + van" | "Train" | "Seaplane" | "Hotel shuttle" | "Rental car";
  from: string;
  to: string;
  tz: string;
  durationMin: number;
  /** Local operating window. Boats in Palawan do not run after dark. */
  window?: { start: string; end: string };
  /** Minutes after a flight lands before the transfer can leave. */
  arrivalBufferMin: number;
  pricePerVehicle: NOK;
  perPerson?: boolean;
  maxPerVehicle: number;
  supplier: string;
}

export const TRANSFERS: TransferProduct[] = [
  { id: "bkk-airport-city", name: "Suvarnabhumi → hotel", mode: "Private car", from: "BKK airport", to: "Bangkok hotel", tz: "Asia/Bangkok", durationMin: 60, arrivalBufferMin: 50, pricePerVehicle: 450, maxPerVehicle: 3, supplier: "Mock Transfers Asia" },
  { id: "bkk-city-airport", name: "Hotel → Suvarnabhumi", mode: "Private car", from: "Bangkok hotel", to: "BKK airport", tz: "Asia/Bangkok", durationMin: 60, arrivalBufferMin: 0, pricePerVehicle: 450, maxPerVehicle: 3, supplier: "Mock Transfers Asia" },
  { id: "ceb-airport-hotel", name: "Terminal → Waterfront Airport Hotel", mode: "Hotel shuttle", from: "CEB airport", to: "Hotel", tz: "Asia/Manila", durationMin: 10, arrivalBufferMin: 40, pricePerVehicle: 0, maxPerVehicle: 8, supplier: "Hotel shuttle (included)" },
  { id: "usu-houseboat", name: "Busuanga airport → Paolyn Houseboats", mode: "Boat + van", from: "USU airport", to: "Coron Bay houseboat", tz: "Asia/Manila", durationMin: 70, window: { start: "06:00", end: "17:30" }, arrivalBufferMin: 40, pricePerVehicle: 1100, maxPerVehicle: 6, supplier: "Mock Palawan Transfers" },
  { id: "houseboat-twoseasons", name: "Houseboat → Two Seasons Coron", mode: "Speedboat", from: "Coron Bay", to: "Two Seasons Coron", tz: "Asia/Manila", durationMin: 60, window: { start: "07:00", end: "16:30" }, arrivalBufferMin: 0, pricePerVehicle: 2200, maxPerVehicle: 8, supplier: "Mock Palawan Transfers" },
  { id: "twoseasons-usu", name: "Two Seasons Coron → Busuanga airport", mode: "Boat + van", from: "Two Seasons Coron", to: "USU airport", tz: "Asia/Manila", durationMin: 75, window: { start: "06:00", end: "17:00" }, arrivalBufferMin: 0, pricePerVehicle: 1600, maxPerVehicle: 8, supplier: "Mock Palawan Transfers" },
  { id: "eni-cauayan", name: "El Nido airport → Cauayan Island Resort", mode: "Speedboat", from: "ENI airport", to: "Cauayan Island", tz: "Asia/Manila", durationMin: 60, window: { start: "06:00", end: "16:30" }, arrivalBufferMin: 30, pricePerVehicle: 1900, maxPerVehicle: 8, supplier: "Mock Palawan Transfers" },
  { id: "cauayan-eni", name: "Cauayan Island Resort → El Nido airport", mode: "Speedboat", from: "Cauayan Island", to: "ENI airport", tz: "Asia/Manila", durationMin: 60, window: { start: "06:00", end: "16:30" }, arrivalBufferMin: 0, pricePerVehicle: 1900, maxPerVehicle: 8, supplier: "Mock Palawan Transfers" },
  { id: "mnl-airport-city", name: "Manila airport → hotel", mode: "Private car", from: "MNL airport", to: "Manila hotel", tz: "Asia/Manila", durationMin: 50, arrivalBufferMin: 50, pricePerVehicle: 380, maxPerVehicle: 3, supplier: "Mock Transfers Asia" },
  { id: "mnl-city-airport", name: "Hotel → Manila airport", mode: "Private car", from: "Manila hotel", to: "MNL airport", tz: "Asia/Manila", durationMin: 60, arrivalBufferMin: 0, pricePerVehicle: 380, maxPerVehicle: 3, supplier: "Mock Transfers Asia" },
  { id: "pmi-coach", name: "Palma airport → hotel", mode: "Private van", from: "PMI airport", to: "Beach hotel", tz: "Europe/Madrid", durationMin: 75, arrivalBufferMin: 40, pricePerVehicle: 1100, maxPerVehicle: 7, supplier: "Mock Mallorca Transfers" },
  { id: "pmi-coach-back", name: "Hotel → Palma airport", mode: "Private van", from: "Beach hotel", to: "PMI airport", tz: "Europe/Madrid", durationMin: 75, arrivalBufferMin: 0, pricePerVehicle: 1100, maxPerVehicle: 7, supplier: "Mock Mallorca Transfers" },
  { id: "hnd-city", name: "Haneda → hotel", mode: "Private car", from: "HND airport", to: "Tokyo hotel", tz: "Asia/Tokyo", durationMin: 40, arrivalBufferMin: 60, pricePerVehicle: 1450, maxPerVehicle: 3, supplier: "Mock Japan Transfers" },
  { id: "tokyo-kyoto-train", name: "Shinkansen Tokyo → Kyoto", mode: "Train", from: "Tokyo Station", to: "Kyoto Station", tz: "Asia/Tokyo", durationMin: 135, arrivalBufferMin: 0, pricePerVehicle: 980, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Japan" },
  { id: "kyoto-osaka-train", name: "Train Kyoto → Osaka", mode: "Train", from: "Kyoto Station", to: "Osaka Namba", tz: "Asia/Tokyo", durationMin: 50, arrivalBufferMin: 0, pricePerVehicle: 110, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Japan" },
  { id: "osaka-kix", name: "Osaka → Kansai airport", mode: "Train", from: "Osaka Namba", to: "KIX airport", tz: "Asia/Tokyo", durationMin: 45, arrivalBufferMin: 0, pricePerVehicle: 140, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Japan" },
  { id: "vce-watertaxi", name: "Marco Polo → hotel by water taxi", mode: "Speedboat", from: "VCE airport", to: "Dorsoduro", tz: "Europe/Rome", durationMin: 35, arrivalBufferMin: 35, pricePerVehicle: 1500, maxPerVehicle: 6, supplier: "Mock Italia Transfers" },
  { id: "venice-florence-train", name: "Frecciarossa Venice → Florence", mode: "Train", from: "Venezia S. Lucia", to: "Firenze S.M.N.", tz: "Europe/Rome", durationMin: 125, arrivalBufferMin: 0, pricePerVehicle: 450, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Italia" },
  { id: "florence-fco", name: "Florence → Rome Fiumicino (train + car)", mode: "Train", from: "Firenze S.M.N.", to: "FCO airport", tz: "Europe/Rome", durationMin: 150, arrivalBufferMin: 0, pricePerVehicle: 620, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Italia" },
  { id: "bkk-airport-city-budget", name: "Airport Rail Link → city", mode: "Train", from: "BKK airport", to: "Silom", tz: "Asia/Bangkok", durationMin: 55, arrivalBufferMin: 50, pricePerVehicle: 15, perPerson: true, maxPerVehicle: 99, supplier: "Mock Transfers Asia" },
  { id: "tos-car", name: "Rental car, Tromsø (6 days)", mode: "Rental car", from: "TOS airport", to: "Lyngen & back", tz: "Europe/Oslo", durationMin: 30, arrivalBufferMin: 40, pricePerVehicle: 4800, maxPerVehicle: 5, supplier: "Mock Car Rental" },
  { id: "mle-seaplane", name: "Seaplane Malé → resort", mode: "Seaplane", from: "MLE airport", to: "Resort", tz: "Indian/Maldives", durationMin: 50, window: { start: "06:00", end: "16:30" }, arrivalBufferMin: 60, pricePerVehicle: 7800, perPerson: true, maxPerVehicle: 99, supplier: "Mock Maldives Air" },
  { id: "mle-seaplane-back", name: "Seaplane resort → Malé", mode: "Seaplane", from: "Resort", to: "MLE airport", tz: "Indian/Maldives", durationMin: 50, window: { start: "06:00", end: "16:30" }, arrivalBufferMin: 0, pricePerVehicle: 7800, perPerson: true, maxPerVehicle: 99, supplier: "Mock Maldives Air" },
  { id: "zrh-zermatt", name: "Train Zürich airport → Zermatt", mode: "Train", from: "ZRH airport", to: "Zermatt", tz: "Europe/Zurich", durationMin: 210, arrivalBufferMin: 30, pricePerVehicle: 1150, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Swiss" },
  { id: "zermatt-zrh", name: "Train Zermatt → Zürich airport", mode: "Train", from: "Zermatt", to: "ZRH airport", tz: "Europe/Zurich", durationMin: 210, arrivalBufferMin: 0, pricePerVehicle: 1150, perPerson: true, maxPerVehicle: 99, supplier: "Mock Rail Swiss" },
];

export interface ActivityProduct {
  id: string;
  name: string;
  city: string;
  tz: string;
  start: string;
  durationMin: number;
  pricePerPerson: NOK;
  supplier: string;
  description: string;
  freeCancelDays: number;
}

export const ACTIVITIES: ActivityProduct[] = [
  { id: "bkk-food-tuktuk", name: "Bangkok street food by tuk-tuk", city: "Bangkok", tz: "Asia/Bangkok", start: "18:00", durationMin: 240, pricePerPerson: 890, supplier: "Mock Experiences", description: "Evening tasting route through Chinatown and the flower market.", freeCancelDays: 1 },
  { id: "bkk-grand-palace", name: "Grand Palace & Wat Pho with a guide", city: "Bangkok", tz: "Asia/Bangkok", start: "08:30", durationMin: 210, pricePerPerson: 640, supplier: "Mock Experiences", description: "Early start to beat the heat and the crowds.", freeCancelDays: 1 },
  { id: "coron-private-hopping", name: "Private island hopping: Kayangan Lake & Twin Lagoon", city: "Coron", tz: "Asia/Manila", start: "08:00", durationMin: 480, pricePerPerson: 1150, supplier: "Mock Experiences", description: "Private bangka with lunch on a quiet beach.", freeCancelDays: 2 },
  { id: "elnido-tour-a", name: "El Nido Tour A: Big & Small Lagoon by kayak", city: "El Nido", tz: "Asia/Manila", start: "09:00", durationMin: 420, pricePerPerson: 780, supplier: "Mock Experiences", description: "Kayak into the lagoons before the day boats arrive.", freeCancelDays: 2 },
  { id: "elnido-sunset-sail", name: "Sunset sail in Bacuit Bay", city: "El Nido", tz: "Asia/Manila", start: "16:00", durationMin: 180, pricePerPerson: 1250, supplier: "Mock Experiences", description: "Traditional paraw sailboat with drinks on board.", freeCancelDays: 2 },
  { id: "kyoto-tea", name: "Tea ceremony in a Kyoto machiya", city: "Kyoto", tz: "Asia/Tokyo", start: "14:00", durationMin: 90, pricePerPerson: 650, supplier: "Mock Experiences", description: "Small-group ceremony with a tea master.", freeCancelDays: 2 },
  { id: "osaka-food-walk", name: "Osaka night food walk", city: "Osaka", tz: "Asia/Tokyo", start: "18:30", durationMin: 180, pricePerPerson: 1100, supplier: "Mock Experiences", description: "Takoyaki, kushikatsu and izakaya stops in Dotonbori.", freeCancelDays: 2 },
  { id: "venice-gondola", name: "Private gondola at golden hour", city: "Venice", tz: "Europe/Rome", start: "18:00", durationMin: 40, pricePerPerson: 720, supplier: "Mock Experiences", description: "A quieter route through Dorsoduro's canals.", freeCancelDays: 2 },
  { id: "chianti-tasting", name: "Chianti vineyard tasting", city: "Florence", tz: "Europe/Rome", start: "10:00", durationMin: 360, pricePerPerson: 1350, supplier: "Mock Experiences", description: "Two family estates and lunch among the vines.", freeCancelDays: 3 },
  { id: "cnx-cooking", name: "Thai cooking class on a farm", city: "Chiang Mai", tz: "Asia/Bangkok", start: "09:00", durationMin: 360, pricePerPerson: 390, supplier: "Mock Experiences", description: "Market visit then cook five dishes.", freeCancelDays: 1 },
  { id: "tos-whale", name: "Arctic wildlife boat trip", city: "Tromsø", tz: "Europe/Oslo", start: "09:00", durationMin: 300, pricePerPerson: 1490, supplier: "Mock Experiences", description: "Family-friendly fjord cruise with sea eagles.", freeCancelDays: 2 },
  { id: "mle-snorkel", name: "Guided house-reef snorkel", city: "Noonu Atoll", tz: "Indian/Maldives", start: "10:00", durationMin: 120, pricePerPerson: 950, supplier: "Mock Experiences", description: "Marine biologist-led snorkel.", freeCancelDays: 1 },
  { id: "zermatt-ski-guide", name: "Private ski guide, one day", city: "Zermatt", tz: "Europe/Zurich", start: "09:00", durationMin: 420, pricePerPerson: 2400, supplier: "Mock Experiences", description: "Off-piste where conditions allow, Italian lunch over the border.", freeCancelDays: 2 },
];

export const findFlight = (flightNo: string) => FLIGHTS.find((x) => x.flightNo === flightNo);
export const findProperty = (id: string) => PROPERTIES.find((x) => x.id === id);
export const findTransfer = (id: string) => TRANSFERS.find((x) => x.id === id);
export const findActivity = (id: string) => ACTIVITIES.find((x) => x.id === id);
