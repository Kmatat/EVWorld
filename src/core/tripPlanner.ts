import { billedKwh, chargeMinutes, compatibleConnectors, effectivePowerKw, isCompatible, vehicleAccepts } from './charging';
import { roadKm } from './roads';
import { AVERAGE_SPEED_KMH, DEFAULT_RESERVE_PERCENT, consumption, estimateRange, percentForKm } from './range';
import { liveStatus } from './stations';
import { CONNECTOR_LABEL, Connector, DrivingConditions, LatLng, Station, Vehicle, isDcConnector } from './types';

/**
 * TRIP PLANNER
 * ============
 * Question it answers: "With my battery at X%, can I reach my destination?
 * If not, where should I stop to charge, for how long, and what will it cost?"
 *
 * How it works:
 *  1. Estimate road distance and energy use (see range.ts) → battery % at arrival.
 *     If you arrive with at least the safety reserve (10%), no stop is needed.
 *  2. Otherwise, collect chargers that are near the route, fit your car's plug
 *     and are online.
 *  3. Think of every charger as a possible stop. Then compare every possible
 *     chain of stops (start → A → B → destination) and keep the one with the
 *     shortest total trip time:
 *        driving time + charging time + ~8 min per stop to park and plug in
 *        (+ expected waiting time if the charger is busy right now).
 *     Fast chargers win naturally, because they cut charging time. So do
 *     fewer stops, because every stop costs time.
 *  4. At each stop, charge just enough to reach the next stop (or the
 *     destination) with the reserve plus a small buffer. This is what
 *     experienced EV drivers do: charging is fastest when the battery is
 *     low, so many short top-ups beat one long charge to 100%.
 *  5. If no chain reaches the destination, show how far you can get and the
 *     nearest chargers.
 *
 * (Technically this is Dijkstra's shortest-path algorithm, the same idea
 * used by navigation apps. With ~50–500 chargers it runs in milliseconds
 * on a phone.)
 */

export interface TripInput {
  vehicle: Vehicle;
  batteryPercent: number;
  origin: LatLng;
  destination: LatLng;
  conditions: DrivingConditions;
  stations: Station[];
  /** Minimum battery % to arrive with anywhere. */
  reservePercent?: number;
  /** Highest % we allow on DC fast chargers. Charging above ~80% is slow, so the search only goes there when it saves a stop. */
  maxDcChargePercent?: number;
  /** Ignore stations with no free compatible plug right now (instead of adding wait time). */
  availableOnly?: boolean;
  /** How far off the direct route a charger may be. */
  maxDetourKm?: number;
  now?: number;
}

export interface ChargingStop {
  station: Station;
  connector: Connector;
  legKm: number;
  distanceFromStartKm: number;
  arrivalPercent: number;
  departurePercent: number;
  chargeMinutes: number;
  energyKwh: number;
  costEgp?: number;
  detourKm: number;
  availablePlugs: number;
  /** Expected queueing time if the plug is busy right now. */
  waitMinutes: number;
  /** True when the car had to dip into the safety reserve to get here. */
  usesReserve: boolean;
}

export interface NearbyCharger {
  station: Station;
  roadKm: number;
  /** Battery % when you get there (from the start, or after arrival for destination chargers). */
  arrivalPercent: number;
  reachable: boolean;
  availablePlugs: number;
  bestPowerKw: number;
}

export type TripStatus = 'direct' | 'with_stops' | 'unreachable';

export interface TripPlan {
  status: TripStatus;
  directKm: number;
  totalKm: number;
  whPerKm: number;
  /** Safe range right now, keeping the reserve. */
  safeRangeKm: number;
  /** Battery % at arrival if you drove straight there (negative = not possible). */
  directArrivalPercent: number;
  /** Battery % at the destination following this plan. */
  arrivalPercent: number;
  stops: ChargingStop[];
  driveMinutes: number;
  chargeMinutes: number;
  /** Parking, plugging in and expected queueing across all stops. */
  stopOverheadMinutes: number;
  totalMinutes: number;
  chargeCostEgp: number;
  /** Points to draw on the map: start, each stop, destination. */
  path: LatLng[];
  nearOrigin: NearbyCharger[];
  nearDestination: NearbyCharger[];
  /** Chargers along the route the car cannot plug into (adapter opportunity). */
  incompatibleOnRoute: Station[];
  /** If unreachable: km from the start where the battery hits the reserve. */
  strandedAtKm?: number;
  warnings: string[];
  reservePercent: number;
}

interface Candidate {
  station: Station;
  connector: Connector;
  detourKm: number;
  availablePlugs: number;
  waitMin: number;
}

export const STOP_OVERHEAD_MIN = 8;
export const BUSY_WAIT_MIN = 15;
export const ARRIVAL_BUFFER_PERCENT = 3;
const EMERGENCY_FLOOR_PERCENT = 3;

/** A node in the search: the start, a charger (reached from the start or from another charger), or the destination. */
interface Node {
  key: string;
  kind: 'origin' | 'station' | 'destination';
  candidate?: Candidate;
  location: LatLng;
  arrivalPercent: number;
  /** Reached straight from the start, without charging on the way. */
  fromOrigin: boolean;
}

interface Edge {
  from: string;
  legKm: number;
  /** % charged to at the "from" node before leaving (stations only). */
  chargeTo: number;
  chargeMin: number;
  overheadMin: number;
}

export function planTrip(input: TripInput): TripPlan {
  const {
    vehicle,
    origin,
    destination,
    conditions,
    stations,
    reservePercent = DEFAULT_RESERVE_PERCENT,
    maxDcChargePercent = 100,
    availableOnly = false,
    now = Date.now(),
  } = input;
  const soc = Math.max(0, Math.min(100, input.batteryPercent));
  const whPerKm = consumption(vehicle, conditions).totalWhPerKm;
  const pct = (km: number) => percentForKm(vehicle, km, whPerKm);
  const driveMin = (km: number) => (km / AVERAGE_SPEED_KMH[conditions.profile]) * 60;
  const directKm = roadKm(origin, destination);
  const maxDetourKm = input.maxDetourKm ?? Math.max(20, directKm * 0.12);
  const warnings: string[] = [];

  if (soc < reservePercent) {
    warnings.push(`Your battery (${Math.round(soc)}%) is already below your ${reservePercent}% safety reserve.`);
  }

  const compatible = stations.filter((s) => isCompatible(vehicle, s));
  const corridor = (s: Station) => roadKm(origin, s.location) + roadKm(s.location, destination) - directKm;
  const incompatibleOnRoute = stations.filter((s) => !isCompatible(vehicle, s) && corridor(s) <= maxDetourKm);

  // 1. Candidate chargers: compatible, online, near the route. Chargers close to the
  //    start are always allowed, so "charge first, then go" is possible.
  const candidates: Candidate[] = [];
  for (const station of compatible) {
    const detourKm = corridor(station);
    const nearStart = roadKm(origin, station.location) <= 25;
    if (detourKm > maxDetourKm && !nearStart) continue;
    const status = liveStatus(station, now);
    if (status.offline) continue;
    // One candidate per working plug type: a free 22 kW AC plug and a busy
    // 60 kW DC plug are both options. The search decides which is faster.
    const working = status.connectors.filter((c) => vehicleAccepts(vehicle, c.type) && c.count - c.offline > 0);
    const freeTotal = working.reduce((n, c) => n + c.available, 0);
    for (const c of working) {
      if (availableOnly && c.available === 0) continue;
      candidates.push({
        station,
        connector: { type: c.type, powerKw: c.powerKw, count: c.count },
        detourKm: Math.max(0, detourKm),
        availablePlugs: freeTotal,
        waitMin: c.available > 0 ? 0 : BUSY_WAIT_MIN,
      });
    }
  }

  // 2. Search for the fastest chain of stops. If nothing works, allow the first
  //    leg to dip into the reserve (with a warning) before giving up.
  let search = shortestPlan(reservePercent);
  if (!search.reached && soc - pct(directKm) < reservePercent) {
    const emergency = shortestPlan(EMERGENCY_FLOOR_PERCENT);
    if (emergency.reached) search = emergency;
  }

  function shortestPlan(firstLegFloor: number) {
    const nodes = new Map<string, Node>();
    const time = new Map<string, number>();
    const prev = new Map<string, Edge>();
    const done = new Set<string>();
    const originNode: Node = { key: 'origin', kind: 'origin', location: origin, arrivalPercent: soc, fromOrigin: true };
    const destNode: Node = { key: 'dest', kind: 'destination', location: destination, arrivalPercent: NaN, fromOrigin: false };
    nodes.set(originNode.key, originNode);
    nodes.set(destNode.key, destNode);
    time.set('origin', 0);

    const relax = (node: Node, t: number, edge: Edge) => {
      if (t < (time.get(node.key) ?? Infinity)) {
        nodes.set(node.key, node);
        time.set(node.key, t);
        prev.set(node.key, edge);
      }
    };

    while (true) {
      // Pick the unvisited node with the smallest time so far.
      let current: Node | undefined;
      let best = Infinity;
      for (const [key, t] of time) {
        if (!done.has(key) && t < best) {
          best = t;
          current = nodes.get(key);
        }
      }
      if (!current || current.kind === 'destination') break;
      done.add(current.key);

      if (current.kind === 'origin') {
        const arrival = soc - pct(directKm);
        if (arrival >= reservePercent) {
          relax({ ...destNode, arrivalPercent: arrival }, driveMin(directKm), { from: 'origin', legKm: directKm, chargeTo: soc, chargeMin: 0, overheadMin: 0 });
        }
        for (const c of candidates) {
          const legKm = roadKm(origin, c.station.location);
          const a = soc - pct(legKm);
          if (a < firstLegFloor) continue;
          relax(
            { key: `A:${c.station.id}:${c.connector.type}`, kind: 'station', candidate: c, location: c.station.location, arrivalPercent: a, fromOrigin: true },
            driveMin(legKm),
            { from: 'origin', legKm, chargeTo: soc, chargeMin: 0, overheadMin: 0 },
          );
        }
        continue;
      }

      // At a charger: charge just enough for the next leg.
      const c = current.candidate!;
      const cap = isDcConnector(c.connector.type) ? maxDcChargePercent : 100;
      const tNow = time.get(current.key)!;
      const leave = (to: LatLng) => {
        const legKm = roadKm(c.station.location, to);
        const target = reservePercent + ARRIVAL_BUFFER_PERCENT + pct(legKm);
        if (target > cap || current!.arrivalPercent >= target) return undefined;
        const minutes = chargeMinutes(vehicle, c.connector, current!.arrivalPercent, target);
        const overheadMin = STOP_OVERHEAD_MIN + c.waitMin;
        return { legKm, target, edge: { from: current!.key, legKm, chargeTo: target, chargeMin: minutes, overheadMin }, t: tNow + overheadMin + minutes + driveMin(legKm) };
      };

      const toDest = leave(destination);
      if (toDest) relax({ ...destNode, arrivalPercent: toDest.target - pct(toDest.legKm) }, toDest.t, toDest.edge);
      for (const d of candidates) {
        if (d.station.id === c.station.id) continue;
        const hop = leave(d.station.location);
        if (!hop) continue;
        relax(
          { key: `B:${d.station.id}:${d.connector.type}`, kind: 'station', candidate: d, location: d.station.location, arrivalPercent: hop.target - pct(hop.legKm), fromOrigin: false },
          hop.t,
          hop.edge,
        );
      }
    }

    const reached = time.has('dest');
    let endKey = 'dest';
    if (!reached) {
      // Furthest progress: the visited charger closest to the destination.
      let bestKm = directKm;
      endKey = 'origin';
      for (const key of done) {
        const n = nodes.get(key)!;
        const km = roadKm(n.location, destination);
        if (n.kind === 'station' && km < bestKm) {
          bestKm = km;
          endKey = key;
        }
      }
    }
    // Walk back from the end to the start.
    const chain: { node: Node; edgeIn?: Edge }[] = [];
    let key: string | undefined = endKey;
    while (key) {
      const edgeIn = prev.get(key);
      chain.unshift({ node: nodes.get(key)!, edgeIn });
      key = edgeIn?.from;
    }
    return { reached, chain, nodes };
  }

  // 3. Turn the chain into stops and totals.
  const stops: ChargingStop[] = [];
  let driven = 0;
  let driveMinutes = 0;
  let overhead = 0;
  const chain = search.chain;
  for (let i = 0; i < chain.length; i++) {
    const { node, edgeIn } = chain[i];
    if (edgeIn) {
      driven += edgeIn.legKm;
      driveMinutes += driveMin(edgeIn.legKm);
    }
    if (node.kind !== 'station') continue;
    const c = node.candidate!;
    const edgeOut = chain[i + 1]?.edgeIn;
    // The last stop of an unreachable trip: charge to the max and see how far it gets you.
    const cap = isDcConnector(c.connector.type) ? maxDcChargePercent : 100;
    const departure = edgeOut ? edgeOut.chargeTo : Math.max(cap, node.arrivalPercent);
    const minutes = edgeOut ? edgeOut.chargeMin : chargeMinutes(vehicle, c.connector, node.arrivalPercent, departure);
    overhead += edgeOut ? edgeOut.overheadMin : STOP_OVERHEAD_MIN + c.waitMin;
    const energyKwh = billedKwh(vehicle, node.arrivalPercent, departure);
    stops.push({
      station: c.station,
      connector: c.connector,
      legKm: edgeIn!.legKm,
      distanceFromStartKm: driven,
      arrivalPercent: node.arrivalPercent,
      departurePercent: departure,
      chargeMinutes: minutes,
      energyKwh,
      costEgp: c.station.pricePerKwh != null ? energyKwh * c.station.pricePerKwh : undefined,
      detourKm: c.detourKm,
      availablePlugs: c.availablePlugs,
      waitMinutes: c.waitMin,
      usesReserve: node.fromOrigin && node.arrivalPercent < reservePercent,
    });
  }

  const last = chain[chain.length - 1];
  const status: TripStatus = !search.reached ? 'unreachable' : stops.length ? 'with_stops' : 'direct';
  let strandedAtKm: number | undefined;
  let arrivalPercent = search.reached ? last.node.arrivalPercent : NaN;
  if (!search.reached) {
    const lastStop = stops[stops.length - 1];
    const from = lastStop ? lastStop.departurePercent : soc;
    strandedAtKm = driven + Math.max(0, from - reservePercent) / pct(1);
    arrivalPercent = from - pct(roadKm(last.node.location, destination));
  }

  for (const stop of stops) {
    if (stop.usesReserve) {
      warnings.push(`To reach ${stop.station.name} you'll dip below your reserve (arriving at ${Math.round(stop.arrivalPercent)}%). Drive gently.`);
    }
    if (!isDcConnector(stop.connector.type)) {
      warnings.push(`${stop.station.name} only has slow AC charging for your car (about ${Math.round(stop.chargeMinutes)} min).`);
    }
    if (stop.waitMinutes > 0) {
      warnings.push(`The ${CONNECTOR_LABEL[stop.connector.type]} plug at ${stop.station.name} is busy right now; ${BUSY_WAIT_MIN} min of waiting is included.`);
    }
  }
  if (status === 'unreachable') {
    warnings.unshift(
      stops.length
        ? `There is a gap in the charging network on this route. With the stops below you can get about ${Math.round(strandedAtKm!)} km of the way.`
        : 'No reachable charger was found on this route with your current battery. Charge first at one of the nearby stations.',
    );
  }
  if (stops.some((s) => s.costEgp == null)) warnings.push('Some stops have no published price, so the total cost is incomplete.');
  if (stops.length > 0) warnings.push('Charger availability can change before you arrive. Recalculate on the way for the latest status.');

  const chargeTotal = stops.reduce((s, x) => s + x.chargeMinutes, 0);

  return {
    status,
    directKm,
    totalKm: driven,
    whPerKm,
    safeRangeKm: estimateRange(vehicle, soc, conditions, reservePercent).safeRangeKm,
    directArrivalPercent: soc - pct(directKm),
    arrivalPercent,
    stops,
    driveMinutes,
    chargeMinutes: chargeTotal,
    stopOverheadMinutes: overhead,
    totalMinutes: driveMinutes + chargeTotal + overhead,
    chargeCostEgp: stops.reduce((s, x) => s + (x.costEgp ?? 0), 0),
    path: [origin, ...stops.map((s) => s.station.location), ...(search.reached ? [destination] : [])],
    nearOrigin: nearby(compatible, origin, (km) => soc - pct(km), vehicle, now),
    nearDestination: nearby(compatible, destination, (km) => (search.reached ? arrivalPercent - pct(km) : NaN), vehicle, now),
    incompatibleOnRoute,
    strandedAtKm,
    warnings,
    reservePercent,
  };
}

function nearby(stations: Station[], from: LatLng, arrivalAt: (km: number) => number, vehicle: Vehicle, now: number, limit = 3): NearbyCharger[] {
  return stations
    .map((station) => ({ station, km: roadKm(from, station.location) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(({ station, km }) => {
      const status = liveStatus(station, now);
      const arrival = arrivalAt(km);
      const best = compatibleConnectors(vehicle, station)[0];
      return {
        station,
        roadKm: km,
        arrivalPercent: arrival,
        reachable: !Number.isNaN(arrival) && arrival >= EMERGENCY_FLOOR_PERCENT,
        availablePlugs: status.offline
          ? 0
          : status.connectors.filter((c) => vehicleAccepts(vehicle, c.type)).reduce((n, c) => n + c.available, 0),
        bestPowerKw: best ? effectivePowerKw(vehicle, best) : 0,
      };
    });
}
