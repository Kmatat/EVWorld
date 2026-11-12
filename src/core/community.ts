import { LatLng } from './types';

/**
 * COMMUNITY CHARGING (PEER-TO-PEER)
 * =================================
 * Any user can share their home or office charger with other drivers and
 * be paid per kWh. Business rules:
 *
 *  - The listing is public: plug, power, price, hours, area, host rating.
 *  - The host's phone number is never shown. Everything goes through
 *    in-app chat.
 *  - The exact pin and access instructions ("gate 3, ring flat 12") are
 *    revealed only after the host accepts a request. Until then the map
 *    shows an approximate point a few hundred metres away, if the host
 *    chose that option.
 *  - Price: the host sets a price per kWh. The driver pays that plus a
 *    service fee. The host receives the energy amount, and EVWorld keeps
 *    the fee.
 *  - kWh are measured by the host's smart charger when it has an app or
 *    OCPP connection, by meter photos before/after, or estimated from
 *    charging time.
 */

export type CommunityPlug = 'type2_tethered' | 'type2_socket' | 'gbt_ac' | 'household';

export const COMMUNITY_PLUG_LABEL: Record<CommunityPlug, string> = {
  type2_tethered: 'Wallbox with Type 2 cable',
  type2_socket: 'Wallbox, Type 2 socket (bring your cable)',
  gbt_ac: 'Wallbox with GB/T cable',
  household: 'Wall socket (bring your portable charger)',
};

/** Which car plug each option serves. A household socket works with any car that carries a portable charger. */
export const COMMUNITY_PLUG_CONNECTOR: Record<CommunityPlug, 'type2' | 'gbt_ac' | 'any'> = {
  type2_tethered: 'type2',
  type2_socket: 'type2',
  gbt_ac: 'gbt_ac',
  household: 'any',
};

export type ParkingType = 'private_garage' | 'villa_driveway' | 'compound_parking' | 'street';

export const PARKING_LABEL: Record<ParkingType, string> = {
  private_garage: 'Private garage',
  villa_driveway: 'Villa driveway',
  compound_parking: 'Compound parking',
  street: 'Street parking',
};

export interface WeeklyAvailability {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  from: string; // "HH:MM"
  to: string; // "HH:MM", may be past midnight (e.g. 18:00 → 02:00)
}

export interface CommunityCharger {
  id: string;
  hostId: string;
  /** First name + initial, never the full name or phone number. */
  hostName: string;
  hostRating: number;
  hostSessions: number;
  hostPhoneVerified: boolean;
  title: string;
  plug: CommunityPlug;
  powerKw: number;
  pricePerKwh: number;
  area: string;
  city: string;
  /** The real location. Shared only after a request is accepted (when approximate). */
  location: LatLng;
  showApproximate: boolean;
  availability: WeeklyAvailability;
  parking: ParkingType;
  /** Private: shared only with accepted drivers. */
  accessInstructions: string;
  description: string;
  paused: boolean;
  createdAt: number;
}

export const SERVICE_FEE_RATE = 0.1;
export const MIN_SERVICE_FEE_EGP = 5;

export interface SessionQuote {
  kWh: number;
  energyCost: number;
  serviceFee: number;
  total: number;
  hostEarnings: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quoteSession(kWh: number, pricePerKwh: number): SessionQuote {
  const energyCost = round2(Math.max(0, kWh) * pricePerKwh);
  const serviceFee = energyCost === 0 ? 0 : round2(Math.max(MIN_SERVICE_FEE_EGP, energyCost * SERVICE_FEE_RATE));
  return { kWh: round2(Math.max(0, kWh)), energyCost, serviceFee, total: round2(energyCost + serviceFee), hostEarnings: energyCost };
}

export type KwhMeasurement =
  | { method: 'meter'; startReading: number; endReading: number }
  | { method: 'timer'; minutes: number; chargerKw: number; carMaxAcKw: number };

/** Typical losses between the wall and the battery for AC charging. */
export const AC_CHARGING_EFFICIENCY = 0.9;

/**
 * kWh delivered in a session. Meter readings are the most trustworthy (the
 * driver can see a photo of the meter). The timer estimate is for chargers
 * without a meter.
 */
export function measureSessionKwh(m: KwhMeasurement): { kWh: number; error?: string } {
  if (m.method === 'meter') {
    const kWh = m.endReading - m.startReading;
    if (!Number.isFinite(kWh) || kWh < 0) return { kWh: 0, error: 'The end reading must be higher than the start reading.' };
    if (kWh > 120) return { kWh, error: 'That is more than a car battery holds. Please check the readings.' };
    return { kWh: round2(kWh) };
  }
  if (m.minutes <= 0) return { kWh: 0, error: 'Enter how long the car was charging.' };
  const power = Math.min(m.chargerKw, m.carMaxAcKw);
  return { kWh: round2(power * (m.minutes / 60) * AC_CHARGING_EFFICIENCY) };
}

/**
 * Suggested price range for a host, from what they pay for electricity.
 * EV charging pushes most homes into the top residential tiers, so hosts
 * should use the price from their latest bill.
 */
export function suggestHostPrice(ownCostPerKwh: number) {
  const r = (n: number) => Math.round(n * 4) / 4;
  return { low: r(ownCostPerKwh * 1.2), suggested: r(ownCostPerKwh * 1.4), high: r(ownCostPerKwh * 1.7) };
}

/** Monthly earnings estimate shown in the host form. */
export function estimateHostEarnings(pricePerKwh: number, ownCostPerKwh: number, sessionsPerWeek: number, kWhPerSession = 20) {
  const kWhPerMonth = sessionsPerWeek * 4.3 * kWhPerSession;
  return {
    kWhPerMonth: Math.round(kWhPerMonth),
    revenue: Math.round(kWhPerMonth * pricePerKwh),
    profit: Math.round(kWhPerMonth * (pricePerKwh - ownCostPerKwh)),
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A stable point 250–450 m away from the real location (always the same
 * point for the same charger, so it can't be averaged out by reloading).
 */
export function approximateLocation(real: LatLng, chargerId: string): LatLng {
  const h = hash(chargerId);
  const angle = ((h % 360) * Math.PI) / 180;
  const distanceKm = 0.25 + ((h >>> 9) % 200) / 1000;
  const dLat = (distanceKm / 111.32) * Math.cos(angle);
  const dLng = (distanceKm / (111.32 * Math.cos((real.lat * Math.PI) / 180))) * Math.sin(angle);
  return { lat: real.lat + dLat, lng: real.lng + dLng };
}

/** What a given viewer may see of the location. */
export function visibleLocation(charger: CommunityCharger, viewerHasAcceptedBooking: boolean, viewerIsHost: boolean) {
  const exact = !charger.showApproximate || viewerHasAcceptedBooking || viewerIsHost;
  return { location: exact ? charger.location : approximateLocation(charger.location, charger.id), exact };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Is the charger open at this moment (handles overnight windows)? */
export function isAvailableAt(a: WeeklyAvailability, date: Date): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const from = toMinutes(a.from);
  const to = toMinutes(a.to);
  const day = date.getDay();
  if (from <= to) return a.days.includes(day) && minutes >= from && minutes < to;
  // Overnight: the evening part belongs to today, the early-morning part to yesterday's window.
  const yesterday = (day + 6) % 7;
  return (a.days.includes(day) && minutes >= from) || (a.days.includes(yesterday) && minutes < to);
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeAvailability(a: WeeklyAvailability): string {
  const days = [...a.days].sort();
  const label =
    days.length === 7
      ? 'Every day'
      : days.join() === '0,1,2,3,4'
        ? 'Sun–Thu'
        : days.join() === '5,6'
          ? 'Fri–Sat'
          : days.map((d) => DAY[d]).join(', ');
  return `${label}, ${a.from}–${a.to}`;
}

export type BookingStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'charging' | 'completed';

/** Allowed next steps in a booking, by who is acting. */
export function nextBookingActions(status: BookingStatus, role: 'host' | 'driver'): BookingStatus[] {
  const table: Record<BookingStatus, { host: BookingStatus[]; driver: BookingStatus[] }> = {
    requested: { host: ['accepted', 'declined'], driver: ['cancelled'] },
    accepted: { host: ['cancelled'], driver: ['charging', 'cancelled'] },
    charging: { host: [], driver: ['completed'] },
    declined: { host: [], driver: [] },
    cancelled: { host: [], driver: [] },
    completed: { host: [], driver: [] },
  };
  return table[status][role];
}

export function canSeePrivateDetails(status: BookingStatus): boolean {
  return status === 'accepted' || status === 'charging' || status === 'completed';
}
