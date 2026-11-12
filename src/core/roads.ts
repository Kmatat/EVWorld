import { haversineKm } from './geo';
import { LatLng } from './types';

/**
 * MINI ROAD NETWORK OF EGYPT
 * ==========================
 * Straight lines lie in Egypt. A straight line from Zafarana to El Tor
 * crosses the Gulf of Suez, but the real road goes around through the
 * Ahmed Hamdi tunnel. So the prototype carries a small map of the main
 * highways: ~45 junctions and the roads that connect them. It finds the
 * shortest way through them.
 *
 * It lands close to real distances: Cairo → Hurghada ≈ 470 km,
 * Cairo → Sharm El Sheikh ≈ 500 km, Cairo → Aswan ≈ 850 km.
 *
 * In production this is replaced by a commercial routing API (Google
 * Directions / Mapbox) for turn-by-turn accuracy. The rest of the engine
 * only needs a distance between two points, so swapping it is easy.
 */

interface RoadNode {
  id: string;
  name: string;
  at: LatLng;
}

const N = (id: string, name: string, lat: number, lng: number): RoadNode => ({ id, name, at: { lat, lng } });

export const ROAD_NODES: RoadNode[] = [
  N('CAI', 'Cairo', 30.044, 31.236),
  N('HEL', 'Heliopolis', 30.091, 31.322),
  N('NCA', 'New Cairo', 30.03, 31.47),
  N('MDN', 'Madinaty', 30.107, 31.639),
  N('NAC', 'New Capital', 30.02, 31.76),
  N('GIZ', '6th of October / Zayed', 30.01, 30.98),
  N('D65', 'Desert Road km 65', 30.315, 30.71),
  N('WNT', 'Wadi El Natrun', 30.47, 30.45),
  N('BRG', 'Borg El Arab', 30.84, 30.06),
  N('ALX', 'Alexandria', 31.2, 29.92),
  N('MAR', 'Marina El Alamein', 30.83, 29.07),
  N('ALM', 'New Alamein', 30.83, 28.95),
  N('MRS', 'Marassi', 30.96, 28.78),
  N('RHK', 'Ras El Hekma', 31.15, 27.9),
  N('MTR', 'Marsa Matrouh', 31.354, 27.237),
  N('TNT', 'Tanta', 30.787, 31.0),
  N('MNS', 'Mansoura', 31.04, 31.38),
  N('ISM', 'Ismailia', 30.6, 32.27),
  N('PSD', 'Port Said', 31.265, 32.3),
  N('SUZ', 'Suez', 29.97, 32.54),
  N('TUN', 'Ahmed Hamdi Tunnel', 30.09, 32.57),
  N('SDR', 'Ras Sudr', 29.59, 32.71),
  N('AZN', 'Abu Zenima', 29.04, 33.1),
  N('TOR', 'El Tor', 28.24, 33.62),
  N('SHM', 'Sharm El Sheikh', 27.915, 34.33),
  N('DHB', 'Dahab', 28.5, 34.51),
  N('S55', 'Sokhna Road km 55', 29.82, 31.9),
  N('SOK', 'Ain Sokhna', 29.6, 32.32),
  N('GAL', 'Galala', 29.42, 32.38),
  N('ZAF', 'Zafarana', 29.11, 32.65),
  N('RGH', 'Ras Gharib', 28.36, 33.08),
  N('GNA', 'El Gouna', 27.395, 33.678),
  N('HRG', 'Hurghada', 27.257, 33.81),
  N('SFG', 'Safaga', 26.73, 33.94),
  N('MSA', 'Marsa Alam', 25.07, 34.88),
  N('QNA', 'Qena', 26.155, 32.716),
  N('LXR', 'Luxor', 25.69, 32.64),
  N('ASW', 'Aswan', 24.09, 32.9),
  N('FAY', 'Fayoum', 29.31, 30.84),
  N('BSF', 'Beni Suef', 29.07, 31.1),
  N('MNY', 'Minya', 28.11, 30.75),
  N('AST', 'Assiut', 27.18, 31.18),
  N('SHG', 'Sohag', 26.56, 31.7),
];

/** Highways between junctions. */
export const ROAD_SEGMENTS: [string, string][] = [
  // Greater Cairo
  ['CAI', 'HEL'], ['CAI', 'NCA'], ['HEL', 'NCA'], ['NCA', 'MDN'], ['MDN', 'NAC'], ['NCA', 'NAC'], ['CAI', 'GIZ'],
  // Cairo – Alexandria desert road & North Coast
  ['CAI', 'D65'], ['GIZ', 'D65'], ['D65', 'WNT'], ['WNT', 'BRG'], ['BRG', 'ALX'], ['WNT', 'ALM'],
  ['ALX', 'MAR'], ['MAR', 'ALM'], ['ALM', 'MRS'], ['MRS', 'RHK'], ['RHK', 'MTR'],
  // Delta (agricultural road)
  ['CAI', 'TNT'], ['TNT', 'ALX'], ['CAI', 'MNS'], ['TNT', 'MNS'],
  // Canal & Sinai (through the tunnel)
  ['HEL', 'ISM'], ['ISM', 'PSD'], ['ISM', 'SUZ'], ['NCA', 'SUZ'], ['SUZ', 'TUN'], ['ISM', 'TUN'],
  ['TUN', 'SDR'], ['SDR', 'AZN'], ['AZN', 'TOR'], ['TOR', 'SHM'], ['SHM', 'DHB'],
  // Sokhna & Red Sea coast
  ['NCA', 'S55'], ['NAC', 'S55'], ['S55', 'SOK'], ['SUZ', 'SOK'], ['SOK', 'GAL'], ['GAL', 'ZAF'], ['ZAF', 'RGH'],
  ['RGH', 'GNA'], ['GNA', 'HRG'], ['HRG', 'SFG'], ['SFG', 'MSA'], ['SFG', 'QNA'], ['ZAF', 'BSF'],
  // Nile valley
  ['CAI', 'FAY'], ['GIZ', 'FAY'], ['CAI', 'BSF'], ['FAY', 'BSF'], ['BSF', 'MNY'], ['MNY', 'AST'], ['AST', 'SHG'],
  ['SHG', 'QNA'], ['QNA', 'LXR'], ['LXR', 'ASW'],
];

/** Highways between junctions are fairly straight; local streets less so. */
const HIGHWAY_FACTOR = 1.12;
const LOCAL_FACTOR = 1.3;
/** Below this straight-line distance we assume a local, direct route. */
const LOCAL_TRIP_KM = 40;
/** Points farther than this from any junction use the plain straight-line estimate. */
const OFF_NETWORK_KM = 150;

const index = new Map(ROAD_NODES.map((n, i) => [n.id, i]));
const size = ROAD_NODES.length;

// Shortest distance between every pair of junctions (Floyd–Warshall), computed once.
const dist: number[][] = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => (i === j ? 0 : Infinity)));
const next: number[][] = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => (i === j ? j : -1)));
for (const [a, b] of ROAD_SEGMENTS) {
  const i = index.get(a)!;
  const j = index.get(b)!;
  const d = haversineKm(ROAD_NODES[i].at, ROAD_NODES[j].at) * HIGHWAY_FACTOR;
  dist[i][j] = dist[j][i] = d;
  next[i][j] = j;
  next[j][i] = i;
}
for (let k = 0; k < size; k++)
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++)
      if (dist[i][k] + dist[k][j] < dist[i][j]) {
        dist[i][j] = dist[i][k] + dist[k][j];
        next[i][j] = next[i][k];
      }

interface Access {
  node: number;
  km: number;
}

const accessCache = new Map<string, Access[]>();

/** The closest junction(s) to a point: where you join the highway network. */
function accessPoints(p: LatLng): Access[] {
  const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const cached = accessCache.get(key);
  if (cached) return cached;
  const sorted = ROAD_NODES.map((n, node) => ({ node, km: haversineKm(p, n.at) * LOCAL_FACTOR })).sort((a, b) => a.km - b.km);
  const nearest = sorted[0];
  // Only consider a second junction if it is nearly as close (avoids "crossing" the Gulf of Suez).
  const result = sorted.slice(0, 3).filter((a) => a === nearest || a.km <= Math.max(15, nearest.km * 1.5) && a.km < 40);
  accessCache.set(key, result);
  return result;
}

function bestPair(a: LatLng, b: LatLng) {
  let best = { km: Infinity, from: -1, to: -1 };
  for (const x of accessPoints(a))
    for (const y of accessPoints(b)) {
      const km = x.km + dist[x.node][y.node] + y.km;
      if (km < best.km) best = { km, from: x.node, to: y.node };
    }
  return best;
}

const isOffNetwork = (p: LatLng) => accessPoints(p)[0].km / LOCAL_FACTOR > OFF_NETWORK_KM;

/**
 * Short trips use a direct estimate, unless the highway network says the
 * real road is much longer. That means there is water in the way, e.g.
 * Ain Sokhna and Ras Sudr are 37 km apart but on opposite sides of the Gulf.
 */
const WATER_BARRIER_RATIO = 2.2;

function isDirect(a: LatLng, b: LatLng, straight: number, network: number): boolean {
  if (isOffNetwork(a) || isOffNetwork(b)) return true;
  return straight < LOCAL_TRIP_KM && network <= straight * LOCAL_FACTOR * WATER_BARRIER_RATIO;
}

/** Estimated driving distance by road between two points, in km. */
export function roadKm(a: LatLng, b: LatLng): number {
  const straight = haversineKm(a, b);
  if (straight < 0.01) return 0;
  const local = straight * LOCAL_FACTOR;
  if (isOffNetwork(a) || isOffNetwork(b)) return straight * 1.25;
  const network = bestPair(a, b).km;
  if (isDirect(a, b, straight, network)) return Math.min(local, network);
  // Never shorter than the straight line, but may be longer (around the Gulf, etc.).
  return Math.max(network, local * 0.9);
}

/** Approximate road shape between two points, for drawing on the map. */
export function routeShape(a: LatLng, b: LatLng): LatLng[] {
  const straight = haversineKm(a, b);
  if (straight < 0.01 || isOffNetwork(a) || isOffNetwork(b)) return [a, b];
  const { from, to, km } = bestPair(a, b);
  if (isDirect(a, b, straight, km)) return [a, b];
  if (from < 0) return [a, b];
  const points: LatLng[] = [a];
  let i = from;
  points.push(ROAD_NODES[i].at);
  while (i !== to) {
    i = next[i][to];
    if (i < 0) break;
    points.push(ROAD_NODES[i].at);
  }
  points.push(b);
  // Drop junctions that sit on top of the start/end point.
  return points.filter((p, k) => k === 0 || haversineKm(p, points[k - 1]) > 0.5);
}

/** Production routing services (Google Directions, Mapbox, OSRM) plug in behind this interface. */
export interface RoutingProvider {
  route(from: LatLng, to: LatLng): Promise<{ distanceKm: number; durationMin: number; shape: LatLng[] }>;
}

/** Offline estimator used by the prototype. */
export const offlineRouting: RoutingProvider = {
  async route(from, to) {
    const distanceKm = roadKm(from, to);
    return { distanceKm, durationMin: (distanceKm / 80) * 60, shape: routeShape(from, to) };
  },
};

/** Road shape through a list of points (start, stops, destination). */
export function routeShapeThrough(points: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 1; i < points.length; i++) {
    const leg = routeShape(points[i - 1], points[i]);
    out.push(...(i === 1 ? leg : leg.slice(1)));
  }
  return points.length === 1 ? [...points] : out;
}
