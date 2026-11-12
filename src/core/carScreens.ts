import { compatibleConnectors, effectivePowerKw } from './charging';
import { formatDuration, formatKm } from './geo';
import { roadKm } from './roads';
import { liveStatus } from './stations';
import { TripPlan } from './tripPlanner';
import { LatLng, Station, Vehicle } from './types';

/**
 * CAR SCREENS (APPLE CARPLAY & ANDROID AUTO)
 * ==========================================
 * Car screens are not free-form. Apple and Google only allow fixed
 * templates (lists, a map with points, an information panel), with limits
 * on items and text, so drivers aren't distracted. An "EV charging" app
 * gets:
 *   - a map/list of chargers (CarPlay: point-of-interest template, up to 12
 *     points; Android Auto: place list + map, about 6 rows while driving),
 *   - an information panel (battery, next stop, arrival %),
 *   - buttons such as "Navigate", which hands the route to Apple Maps,
 *     Google Maps or Waze on the car screen.
 *
 * This file builds those screens from app data as plain objects. A thin
 * native adapter draws them with each platform's templates, and the in-app
 * "car screen preview" draws the same objects, so what you see in the demo
 * is what the car shows.
 */

export interface CarPoi {
  id: string;
  title: string;
  /** Short second line: "12 km · 2/4 free · 120 kW". */
  detail: string;
  location: LatLng;
  available: boolean;
}

export interface CarPoiScreen {
  kind: 'poi';
  title: string;
  items: CarPoi[];
}

export interface CarInfoScreen {
  kind: 'info';
  title: string;
  rows: { label: string; value: string }[];
  actions: { id: 'navigate' | 'chargers' | 'replan'; title: string }[];
}

export const CARPLAY_MAX_POIS = 12;
export const ANDROID_AUTO_MAX_ROWS = 6;

export function chargerPoiScreen(stations: Station[], vehicle: Vehicle, from: LatLng, now: number, maxItems = CARPLAY_MAX_POIS): CarPoiScreen {
  const items = stations
    .filter((s) => compatibleConnectors(vehicle, s).length > 0)
    .map((s) => ({ s, km: roadKm(from, s.location), live: liveStatus(s, now) }))
    .filter((x) => !x.live.offline)
    .sort((a, b) => a.km - b.km)
    .slice(0, maxItems)
    .map(({ s, km, live }) => {
      const best = compatibleConnectors(vehicle, s)[0];
      return {
        id: s.id,
        title: s.name.length > 28 ? s.name.slice(0, 27) + '…' : s.name,
        detail: `${formatKm(km)} · ${live.availablePlugs}/${live.totalPlugs} free · ${effectivePowerKw(vehicle, best)} kW`,
        location: s.location,
        available: live.availablePlugs > 0,
      };
    });
  return { kind: 'poi', title: 'Chargers for your car', items };
}

export function tripInfoScreen(args: {
  plan: TripPlan;
  batteryPercent: number;
  batterySourceLabel: string;
  kmDriven: number;
  destinationName: string;
  /** Live safe range during a trip (defaults to the plan's value at planning time). */
  rangeKm?: number;
  /** Stops already charged at during this trip (left out of the car screen). */
  doneStopIds?: string[];
  /** km already driven along the current plan (to show distance to the next stop). */
  progressKm?: number;
}): CarInfoScreen {
  const { batteryPercent, batterySourceLabel, destinationName, doneStopIds = [], progressKm = 0 } = args;
  const remaining = args.plan.stops.filter((s) => !doneStopIds.includes(s.station.id));
  const plan: TripPlan = { ...args.plan, stops: remaining, status: args.plan.status === 'with_stops' && remaining.length === 0 ? 'direct' : args.plan.status };
  const next = plan.stops[0];
  const rows = [
    { label: 'Battery', value: `${Math.round(batteryPercent)}% (${batterySourceLabel})` },
    { label: 'Range left', value: formatKm(args.rangeKm ?? plan.safeRangeKm) },
  ];
  if (next) {
    rows.push({ label: 'Next charge', value: `${next.station.name} in ${formatKm(Math.max(0, next.distanceFromStartKm - progressKm))}` });
    rows.push({ label: 'Charge there', value: `${Math.round(next.arrivalPercent)}% → ${Math.round(next.departurePercent)}%, ${formatDuration(next.chargeMinutes)}` });
  }
  if (plan.status !== 'unreachable') {
    rows.push({ label: destinationName.length > 20 ? 'Destination' : destinationName, value: `Arrive with ${Math.round(plan.arrivalPercent)}%` });
  } else {
    rows.push({ label: 'Warning', value: `Charge before ${formatKm(plan.strandedAtKm ?? 0)}` });
  }
  return {
    kind: 'info',
    title: plan.status === 'direct' ? 'On track, no charging needed' : plan.status === 'with_stops' ? `${plan.stops.length} charging stop${plan.stops.length > 1 ? 's' : ''}` : 'Charge soon',
    rows: rows.slice(0, 5),
    actions: [
      { id: 'navigate', title: next ? 'Navigate to charger' : 'Navigate' },
      { id: 'chargers', title: 'Chargers nearby' },
    ],
  };
}
