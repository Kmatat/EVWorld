import { DrivingStyle, LatLng, RouteProfile } from './types';

/**
 * AUTOMATIC DRIVING CONDITIONS
 * ============================
 * The range depends on temperature, AC, road type and driving style. The
 * driver shouldn't have to set these by hand:
 *
 *  - Temperature: live weather at the start and destination. Offline, the
 *    typical temperature for the region and month.
 *  - AC: read from the car where available (connected-car accounts,
 *    Android Automotive). Otherwise assumed on above 26°C and off in mild
 *    weather. In Egypt that guess is right most of the year.
 *  - Road type: from the trip itself (long trips are mostly highway).
 *  - Driving style: from how the car is actually driven (speed and hard
 *    accelerations from GPS or the car). Once the car reports real battery
 *    use, the learned energy-per-km replaces the style guess entirely.
 */

/** Typical daytime high (°C) by month, Jan → Dec. Long-term averages, rounded. */
const CLIMATE: Record<'cairo' | 'coast' | 'redsea' | 'upper', number[]> = {
  cairo: [19, 21, 24, 28, 32, 34, 35, 35, 33, 30, 25, 21],
  coast: [18, 19, 21, 24, 27, 29, 30, 31, 30, 28, 24, 20],
  redsea: [22, 23, 25, 29, 32, 34, 35, 35, 33, 30, 27, 23],
  upper: [23, 25, 30, 35, 39, 41, 41, 41, 39, 35, 29, 24],
};

export function climateRegion(p: LatLng): keyof typeof CLIMATE {
  if (p.lat >= 30.75) return 'coast';
  if (p.lat < 27.6 && p.lng < 33.3) return 'upper';
  if (p.lng >= 32.3) return 'redsea';
  return 'cairo';
}

/** Typical temperature for a place and date; slightly cooler at night. */
export function typicalTemperature(p: LatLng, date: Date): number {
  const high = CLIMATE[climateRegion(p)][date.getMonth()];
  const hour = date.getHours();
  const night = hour < 7 || hour >= 20;
  return night ? high - 8 : high;
}

/** Extracts the current temperature from an Open-Meteo forecast response. */
export function parseOpenMeteoTemperature(json: unknown): number | undefined {
  const t = (json as { current?: { temperature_2m?: unknown } })?.current?.temperature_2m;
  return typeof t === 'number' && Number.isFinite(t) ? t : undefined;
}

/** Trip temperature: the warmer of start and destination (AC load follows the heat). */
export function tripTemperature(start: number, destination?: number): number {
  return destination == null ? start : Math.round(Math.max(start, destination));
}

/** AC is on in the heat and heating in the cold; off in between. */
export function inferClimateOn(temperatureC: number): boolean {
  return temperatureC >= 26 || temperatureC <= 12;
}

/** Road type from trip length (until live speed data says otherwise). */
export function profileFromDistance(km: number): RouteProfile {
  if (km < 25) return 'city';
  if (km < 70) return 'mixed';
  return 'highway';
}

/** Road type from the average moving speed. */
export function profileFromSpeed(avgKmh: number): RouteProfile {
  if (avgKmh < 40) return 'city';
  if (avgKmh < 75) return 'mixed';
  return 'highway';
}

export interface SpeedSample {
  /** Seconds since start. */
  t: number;
  speedKmh: number;
}

/** Thresholds for an "aggressive" event, in m/s². */
const HARD_ACCEL = 2.5;
const HARD_BRAKE = -3.0;

export interface StyleAnalysis {
  style: DrivingStyle;
  hardEventsPer10Km: number;
  avgMovingKmh: number;
  share130Plus: number;
  km: number;
}

/**
 * Driving style from speed samples (1 sample every 1–5 s from GPS or the car).
 * Sporty: frequent hard accelerations/braking, or long stretches above 130 km/h.
 * Eco: smooth driving and moderate speeds.
 */
export function analyzeDrivingStyle(samples: SpeedSample[]): StyleAnalysis | undefined {
  if (samples.length < 10) return undefined;
  let km = 0;
  let movingSeconds = 0;
  let fastSeconds = 0;
  let hardEvents = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt <= 0 || dt > 30) continue;
    const v0 = samples[i - 1].speedKmh / 3.6;
    const v1 = samples[i].speedKmh / 3.6;
    const accel = (v1 - v0) / dt;
    if (accel >= HARD_ACCEL || accel <= HARD_BRAKE) hardEvents++;
    km += (((v0 + v1) / 2) * dt) / 1000;
    if (samples[i].speedKmh > 5) movingSeconds += dt;
    if (samples[i].speedKmh >= 130) fastSeconds += dt;
  }
  if (km < 2) return undefined;
  const hardEventsPer10Km = (hardEvents / km) * 10;
  const share130Plus = movingSeconds ? fastSeconds / movingSeconds : 0;
  const avgMovingKmh = movingSeconds ? km / (movingSeconds / 3600) : 0;
  const style: DrivingStyle = hardEventsPer10Km > 4 || share130Plus > 0.25 ? 'sporty' : hardEventsPer10Km < 1 && share130Plus < 0.05 ? 'eco' : 'normal';
  return { style, hardEventsPer10Km, avgMovingKmh, share130Plus, km };
}
