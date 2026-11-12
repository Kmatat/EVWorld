import { compatibleConnectors, hasDc, maxPowerKw } from './charging';
import { haversineKm } from './geo';
import { roadKm } from './roads';
import { ConnectorType, LatLng, LiveConnector, Station, Vehicle } from './types';

/**
 * LIVE STATUS
 * ===========
 * In production, live status comes from each charging network. They send it
 * over the OCPI protocol (the industry standard for sharing charger status
 * and prices) or a private API.
 *
 * The prototype simulates it. Every 5 minutes each station gets a new random
 * but repeatable status, so the app "feels" live. The rest of the app does not
 * care where the status comes from.
 */

export const STATUS_REFRESH_MS = 5 * 60 * 1000;

/** Small deterministic pseudo-random generator (mulberry32). */
function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
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

export interface LiveStation {
  station: Station;
  connectors: LiveConnector[];
  availablePlugs: number;
  totalPlugs: number;
  /** Whole site is down. */
  offline: boolean;
  updatedAt: number;
}

export function liveStatus(station: Station, now: number = Date.now()): LiveStation {
  const bucket = Math.floor(now / STATUS_REFRESH_MS);
  const rand = seededRandom(hash(station.id) ^ bucket);
  // ~6% of sites are fully offline at any moment, a realistic figure for young networks.
  const siteOffline = rand() < 0.06;
  const connectors: LiveConnector[] = station.connectors.map((c) => {
    if (siteOffline) return { ...c, available: 0, occupied: 0, offline: c.count };
    let available = 0;
    let occupied = 0;
    let offline = 0;
    for (let i = 0; i < c.count; i++) {
      const r = rand();
      if (r < 0.08) offline++;
      else if (r < 0.45) occupied++;
      else available++;
    }
    return { ...c, available, occupied, offline };
  });
  const availablePlugs = connectors.reduce((s, c) => s + c.available, 0);
  const totalPlugs = connectors.reduce((s, c) => s + c.count, 0);
  // Pretend the last update arrived shortly before this 5-minute window began.
  const updatedAt = bucket * STATUS_REFRESH_MS - Math.floor(rand() * 60 * 1000);
  return { station, connectors, availablePlugs, totalPlugs, offline: siteOffline, updatedAt };
}

export interface StationFilters {
  /** Only stations the selected car can plug into. */
  compatibleWith?: Vehicle;
  dcOnly?: boolean;
  minPowerKw?: number;
  availableOnly?: boolean;
  connectorTypes?: ConnectorType[];
  operatorIds?: string[];
  query?: string;
}

export function filterStations(stations: Station[], filters: StationFilters, now = Date.now()): Station[] {
  const q = filters.query?.trim().toLowerCase();
  return stations.filter((s) => {
    if (filters.compatibleWith && compatibleConnectors(filters.compatibleWith, s).length === 0) return false;
    if (filters.dcOnly && !hasDc(s)) return false;
    if (filters.minPowerKw && maxPowerKw(s) < filters.minPowerKw) return false;
    if (filters.connectorTypes?.length && !s.connectors.some((c) => filters.connectorTypes!.includes(c.type)))
      return false;
    if (filters.operatorIds?.length && !filters.operatorIds.includes(s.operatorId)) return false;
    if (q && !`${s.name} ${s.city} ${s.address} ${s.region}`.toLowerCase().includes(q)) return false;
    if (filters.availableOnly && liveStatus(s, now).availablePlugs === 0) return false;
    return true;
  });
}

/** Stations sorted by estimated driving distance (closest first). */
export interface StationWithDistance {
  station: Station;
  /** Straight-line distance. */
  distanceKm: number;
  /** Estimated road distance. */
  roadKm: number;
}

export function nearestStations(stations: Station[], from: LatLng, limit = 5): StationWithDistance[] {
  return stations
    .map((station) => ({
      station,
      distanceKm: haversineKm(from, station.location),
      roadKm: roadKm(from, station.location),
    }))
    .sort((a, b) => a.roadKm - b.roadKm)
    .slice(0, limit);
}

export function minutesAgo(timestamp: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - timestamp) / 60000));
  return m === 0 ? 'just now' : `${m} min ago`;
}
