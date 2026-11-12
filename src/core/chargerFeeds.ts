import { haversineKm } from './geo';
import { Amenity, Connector, ConnectorType, LiveConnector, Station } from './types';

/**
 * CHARGER DATA FEEDS
 * ==================
 * Accurate data means getting it from the networks themselves:
 *
 *  1. OCPI (Open Charge Point Interface), the industry standard. A network
 *     ("CPO") shares its locations, plug status (free / charging / out of
 *     order) and prices with apps ("eMSPs") in real time. One connection
 *     per network, or one connection to a roaming hub that aggregates
 *     many networks.
 *  2. A network's own private API, for networks without OCPI.
 *  3. Open Charge Map, a public community database. Good for locations,
 *     but no live status.
 *  4. Driver reports in EVWorld.
 *
 * This file turns each feed's format into EVWorld's Station format and
 * merges overlapping feeds, so the rest of the app doesn't care where the
 * data came from.
 */

// ---------- OCPI 2.2.1 (Locations + Tariffs modules) ----------

export type OcpiEvseStatus = 'AVAILABLE' | 'BLOCKED' | 'CHARGING' | 'INOPERATIVE' | 'OUTOFORDER' | 'PLANNED' | 'REMOVED' | 'RESERVED' | 'UNKNOWN';

export interface OcpiConnector {
  id: string;
  standard: string;
  format?: 'SOCKET' | 'CABLE';
  power_type: 'AC_1_PHASE' | 'AC_2_PHASE' | 'AC_3_PHASE' | 'DC';
  max_voltage: number;
  max_amperage: number;
  max_electric_power?: number;
  tariff_ids?: string[];
}

export interface OcpiEvse {
  uid: string;
  evse_id?: string;
  status: OcpiEvseStatus;
  connectors: OcpiConnector[];
  last_updated: string;
}

export interface OcpiLocation {
  country_code: string;
  party_id: string;
  id: string;
  publish: boolean;
  name?: string;
  address: string;
  city: string;
  coordinates: { latitude: string; longitude: string };
  operator?: { name: string };
  evses?: OcpiEvse[];
  facilities?: string[];
  opening_times?: { twentyfourseven: boolean };
  last_updated: string;
}

export interface OcpiTariff {
  id: string;
  currency: string;
  elements: { price_components: { type: 'ENERGY' | 'FLAT' | 'PARKING_TIME' | 'TIME'; price: number; vat?: number; step_size: number }[] }[];
}

const OCPI_STANDARD: Record<string, ConnectorType> = {
  IEC_62196_T2: 'type2',
  IEC_62196_T2_COMBO: 'ccs2',
  CHADEMO: 'chademo',
  GBT_AC: 'gbt_ac',
  GBT_DC: 'gbt_dc',
};

const OCPI_FACILITY: Record<string, Amenity> = {
  HOTEL: 'hotel',
  RESTAURANT: 'restaurant',
  CAFE: 'cafe',
  MALL: 'mall',
  FUEL_STATION: 'fuel',
  WIFI: 'wifi',
};

/** Connector power in kW (OCPI gives watts, or volts × amps). */
export function ocpiPowerKw(c: OcpiConnector): number {
  if (c.max_electric_power) return Math.round(c.max_electric_power / 1000);
  const phases = c.power_type === 'AC_3_PHASE' ? 3 : c.power_type === 'AC_2_PHASE' ? 2 : 1;
  return Math.round((c.max_voltage * c.max_amperage * phases) / 1000);
}

type PlugState = 'available' | 'occupied' | 'offline' | 'ignore';

export function ocpiPlugState(status: OcpiEvseStatus): PlugState {
  switch (status) {
    case 'AVAILABLE':
      return 'available';
    case 'CHARGING':
    case 'BLOCKED':
    case 'RESERVED':
      return 'occupied';
    case 'PLANNED':
    case 'REMOVED':
      return 'ignore';
    default:
      return 'offline';
  }
}

/** Price per kWh incl. VAT from the first ENERGY component of the connector's tariff. */
export function ocpiEnergyPrice(tariff: OcpiTariff | undefined): number | undefined {
  if (!tariff) return undefined;
  for (const el of tariff.elements) {
    const energy = el.price_components.find((p) => p.type === 'ENERGY');
    if (energy) return Math.round(energy.price * (1 + (energy.vat ?? 0) / 100) * 100) / 100;
  }
  return undefined;
}

export interface FeedStation {
  station: Station;
  live: LiveConnector[];
  updatedAt: number;
  source: 'ocpi' | 'ocm' | 'demo';
}

/** OCPI Location → EVWorld Station + live plug counts. Returns undefined for unpublished or unusable locations. */
export function ocpiToStation(loc: OcpiLocation, tariffs: OcpiTariff[] = []): FeedStation | undefined {
  if (!loc.publish) return undefined;
  const lat = Number(loc.coordinates.latitude);
  const lng = Number(loc.coordinates.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

  const groups = new Map<string, LiveConnector>();
  let price: number | undefined;
  for (const evse of loc.evses ?? []) {
    const state = ocpiPlugState(evse.status);
    if (state === 'ignore') continue;
    for (const c of evse.connectors) {
      const type = OCPI_STANDARD[c.standard];
      if (!type) continue;
      const powerKw = ocpiPowerKw(c);
      const key = `${type}:${powerKw}`;
      const g = groups.get(key) ?? { type, powerKw, count: 0, available: 0, occupied: 0, offline: 0 };
      g.count++;
      g[state]++;
      groups.set(key, g);
      if (price == null) price = ocpiEnergyPrice(tariffs.find((t) => c.tariff_ids?.includes(t.id)));
    }
  }
  const live = [...groups.values()];
  if (live.length === 0) return undefined;

  const connectors: Connector[] = live.map(({ type, powerKw, count }) => ({ type, powerKw, count }));
  const updated = Math.max(Date.parse(loc.last_updated) || 0, ...(loc.evses ?? []).map((e) => Date.parse(e.last_updated) || 0));
  return {
    station: {
      id: `ocpi:${loc.country_code}:${loc.party_id}:${loc.id}`,
      name: loc.name ?? loc.address,
      operatorId: `${loc.country_code}-${loc.party_id}`.toLowerCase(),
      location: { lat, lng },
      city: loc.city,
      address: loc.address,
      region: loc.city,
      connectors,
      pricePerKwh: price,
      open24h: loc.opening_times?.twentyfourseven ?? false,
      amenities: (loc.facilities ?? []).map((f) => OCPI_FACILITY[f]).filter((a): a is Amenity => !!a),
    },
    live,
    updatedAt: updated,
    source: 'ocpi',
  };
}

// ---------- Open Charge Map (public community database) ----------

export interface OcmPoi {
  ID: number;
  OperatorInfo?: { Title?: string } | null;
  UsageCost?: string | null;
  AddressInfo: { Title: string; AddressLine1?: string | null; Town?: string | null; Latitude: number; Longitude: number };
  Connections?: { ConnectionType?: { Title?: string } | null; PowerKW?: number | null; Quantity?: number | null; StatusType?: { IsOperational?: boolean | null } | null }[];
  StatusType?: { IsOperational?: boolean | null } | null;
  DateLastStatusUpdate?: string | null;
}

/** Maps Open Charge Map connection titles to EVWorld plug types. */
export function ocmConnectorType(title: string | undefined | null): ConnectorType | undefined {
  if (!title) return undefined;
  if (/GB[-\s/]?T/i.test(title)) return /DC/i.test(title) ? 'gbt_dc' : 'gbt_ac';
  if (/CCS|Combo/i.test(title)) return /Type 1|J1772/i.test(title) ? undefined : 'ccs2';
  if (/CHAdeMO/i.test(title)) return 'chademo';
  if (/Type 2|Mennekes|IEC 62196-2/i.test(title)) return 'type2';
  return undefined;
}

/** Finds a "per kWh" price in free text like "EGP 3.75/kWh" or "3,75 جنيه للكيلووات". */
export function parsePricePerKwh(text: string | undefined | null): number | undefined {
  if (!text) return undefined;
  const t = text.replace(/(\d),(\d)/g, '$1.$2');
  const m = t.match(/(\d+(?:\.\d+)?)\D{0,20}?(?:k\s?wh|كيلو\s?وات)/i) ?? t.match(/(?:EGP|LE)\s*(\d+(?:\.\d+)?)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100 ? n : undefined;
}

export function ocmToStation(poi: OcmPoi): FeedStation | undefined {
  if (poi.StatusType?.IsOperational === false) return undefined;
  const groups = new Map<string, LiveConnector>();
  for (const c of poi.Connections ?? []) {
    const type = ocmConnectorType(c.ConnectionType?.Title);
    if (!type) continue;
    const powerKw = Math.round(c.PowerKW ?? (type === 'type2' || type === 'gbt_ac' ? 7 : 50));
    const count = Math.max(1, c.Quantity ?? 1);
    const key = `${type}:${powerKw}`;
    const g = groups.get(key) ?? { type, powerKw, count: 0, available: 0, occupied: 0, offline: 0 };
    g.count += count;
    // Open Charge Map has no live status: plugs are "unknown", shown as available but flagged.
    if (c.StatusType?.IsOperational === false) g.offline += count;
    else g.available += count;
    groups.set(key, g);
  }
  const live = [...groups.values()];
  if (live.length === 0) return undefined;
  return {
    station: {
      id: `ocm:${poi.ID}`,
      name: poi.AddressInfo.Title,
      operatorId: (poi.OperatorInfo?.Title ?? 'unknown').toLowerCase().replace(/\W+/g, '-'),
      location: { lat: poi.AddressInfo.Latitude, lng: poi.AddressInfo.Longitude },
      city: poi.AddressInfo.Town ?? '',
      address: poi.AddressInfo.AddressLine1 ?? poi.AddressInfo.Title,
      region: poi.AddressInfo.Town ?? '',
      connectors: live.map(({ type, powerKw, count }) => ({ type, powerKw, count })),
      pricePerKwh: parsePricePerKwh(poi.UsageCost),
      open24h: false,
      amenities: [],
    },
    live,
    updatedAt: Date.parse(poi.DateLastStatusUpdate ?? '') || 0,
    source: 'ocm',
  };
}

// ---------- Merging feeds ----------

const SOURCE_RANK: Record<FeedStation['source'], number> = { ocpi: 3, ocm: 2, demo: 1 };

/**
 * The same charger often appears in several feeds. Stations within
 * `radiusM` metres of each other are treated as one site. The best source
 * wins (OCPI live data beats community data), and missing prices are
 * filled in from the others.
 */
export function mergeFeeds(feeds: FeedStation[], radiusM = 60): FeedStation[] {
  const sorted = [...feeds].sort((a, b) => SOURCE_RANK[b.source] - SOURCE_RANK[a.source] || b.updatedAt - a.updatedAt);
  const kept: FeedStation[] = [];
  for (const f of sorted) {
    const twin = kept.find((k) => haversineKm(k.station.location, f.station.location) * 1000 <= radiusM);
    if (!twin) {
      kept.push({ ...f, station: { ...f.station } });
      continue;
    }
    if (twin.station.pricePerKwh == null && f.station.pricePerKwh != null) twin.station.pricePerKwh = f.station.pricePerKwh;
  }
  return kept;
}

/** Live status older than this is shown as "status unknown". */
export const STATUS_MAX_AGE_MIN = 15;

export function isStatusStale(updatedAt: number, now = Date.now(), maxAgeMin = STATUS_MAX_AGE_MIN): boolean {
  return now - updatedAt > maxAgeMin * 60 * 1000;
}
