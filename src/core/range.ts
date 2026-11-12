import { DrivingConditions, RouteProfile, Vehicle } from './types';

/**
 * RANGE ENGINE
 * ============
 * Plain-language summary:
 *
 *   range = usable energy left in the battery ÷ energy used per km
 *
 * 1. Energy left: battery size × battery %. We also keep a safety reserve
 *    (10% by default), because arriving at 0% is not acceptable.
 * 2. Energy per km starts from the official WLTP figure. WLTP is a lab test,
 *    so it is optimistic. We then adjust it for real conditions:
 *      - road type: highway driving at 100–120 km/h uses ~20% more than the
 *        mixed WLTP cycle; city driving uses less, thanks to regenerative braking
 *      - air-conditioning: a fixed power draw (kW). It hurts most in slow
 *        Cairo traffic, because the AC runs for more hours per km
 *      - driving style and number of passengers
 */

/** WLTP is a lab test; real mixed driving typically uses ~10% more energy. */
export const REAL_WORLD_FACTOR = 1.1;

export const PROFILE_FACTOR: Record<RouteProfile, number> = {
  city: 0.88,
  mixed: 1.0,
  highway: 1.22,
};

/** Typical average speed per profile in km/h (used for AC load and drive time). */
export const AVERAGE_SPEED_KMH: Record<RouteProfile, number> = {
  city: 28,
  mixed: 55,
  highway: 100,
};

export const STYLE_FACTOR = { eco: 0.93, normal: 1.0, sporty: 1.12 } as const;

/** Extra energy per additional passenger (~75 kg each). */
export const PER_PASSENGER_FACTOR = 0.015;

export const DEFAULT_RESERVE_PERCENT = 10;

/**
 * Air-conditioning / heating power draw in kW, based on outside temperature.
 * Egypt summers reach 40°C+, so cooling is the main concern; desert nights
 * and winter mornings can still need heating.
 */
export function climatePowerKw(temperatureC: number, climateOn: boolean): number {
  if (!climateOn) return 0.2; // fans, electronics
  if (temperatureC >= 38) return 2.2;
  if (temperatureC >= 32) return 1.6;
  if (temperatureC >= 26) return 1.0;
  if (temperatureC >= 18) return 0.5;
  if (temperatureC >= 10) return 1.0;
  return 2.5;
}

/** Baseline consumption from the official figures, in Wh per km. */
export function baseWhPerKm(vehicle: Vehicle): number {
  return ((vehicle.usableKwh * 1000) / vehicle.wltpKm) * REAL_WORLD_FACTOR;
}

export interface ConsumptionBreakdown {
  /** Real-world baseline for mixed driving. */
  baseWhPerKm: number;
  /** Driving energy after road type, style and load adjustments. */
  drivingWhPerKm: number;
  /** Energy taken by AC/heating, converted to Wh per km. */
  climateWhPerKm: number;
  /** Final figure used for all calculations. */
  totalWhPerKm: number;
}

/**
 * @param factor personal correction learned from this car's real battery
 *   readings (1 = the car behaves exactly like the model predicts; 1.08 =
 *   it uses 8% more). See liveBattery.ts.
 */
export function consumption(vehicle: Vehicle, c: DrivingConditions, factor = 1): ConsumptionBreakdown {
  const base = baseWhPerKm(vehicle);
  const extraPassengers = Math.max(0, c.passengers - 1);
  const driving =
    base * PROFILE_FACTOR[c.profile] * STYLE_FACTOR[c.style] * (1 + extraPassengers * PER_PASSENGER_FACTOR);
  const climate = (climatePowerKw(c.temperatureC, c.climateOn) * 1000) / AVERAGE_SPEED_KMH[c.profile];
  return {
    baseWhPerKm: base,
    drivingWhPerKm: driving * factor,
    climateWhPerKm: climate * factor,
    totalWhPerKm: (driving + climate) * factor,
  };
}

/** Energy stored at a given battery %, in kWh. */
export function energyAtPercent(vehicle: Vehicle, percent: number): number {
  return (vehicle.usableKwh * clampPercent(percent)) / 100;
}

/** kWh needed to drive a distance. */
export function energyForKm(km: number, whPerKm: number): number {
  return (km * whPerKm) / 1000;
}

/** Battery % used by driving a distance. */
export function percentForKm(vehicle: Vehicle, km: number, whPerKm: number): number {
  return (energyForKm(km, whPerKm) / vehicle.usableKwh) * 100;
}

export interface RangeEstimate {
  /** Distance until the battery hits the reserve level. */
  safeRangeKm: number;
  /** Distance until the battery is completely empty (do not plan on this). */
  absoluteRangeKm: number;
  whPerKm: number;
  reservePercent: number;
}

export function estimateRange(
  vehicle: Vehicle,
  batteryPercent: number,
  conditions: DrivingConditions,
  reservePercent = DEFAULT_RESERVE_PERCENT,
  factor = 1,
): RangeEstimate {
  const { totalWhPerKm } = consumption(vehicle, conditions, factor);
  const kmPerPercent = (vehicle.usableKwh * 10) / totalWhPerKm; // (usable/100 kWh × 1000) / Wh-per-km
  const soc = clampPercent(batteryPercent);
  return {
    safeRangeKm: Math.max(0, (soc - reservePercent) * kmPerPercent),
    absoluteRangeKm: soc * kmPerPercent,
    whPerKm: totalWhPerKm,
    reservePercent,
  };
}

/** Learned factors are kept within a sane band so one odd trip can't distort everything. */
export function clampFactor(f: number): number {
  return Math.min(1.5, Math.max(0.7, f));
}

export function clampPercent(p: number): number {
  if (Number.isNaN(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

export const DEFAULT_CONDITIONS: DrivingConditions = {
  profile: 'highway',
  temperatureC: 32,
  climateOn: true,
  style: 'normal',
  passengers: 2,
};
