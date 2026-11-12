import { Vehicle } from './types';

/**
 * LIVE BATTERY DURING A TRIP
 * ==========================
 * The battery % has to stay current while you drive. There are two kinds
 * of input:
 *
 *  1. Real readings from the car: Android Auto's energy level, a
 *     connected-car account (BYD, MG, Tesla, Hyundai/Kia, …) or a Bluetooth
 *     OBD dongle. These arrive every few seconds to a few minutes.
 *  2. Distance driven, from the phone's GPS.
 *
 * Between real readings we estimate: battery drops by (km driven × energy
 * per km). When a real reading arrives we use it as is. We also compare it
 * with what we predicted, to learn this driver's real energy use per km.
 * Every future estimate and trip plan gets more accurate that way.
 */

export type BatterySourceKind = 'car' | 'cloud' | 'obd' | 'manual' | 'estimate';

export interface BatteryReading {
  percent: number;
  at: number;
  source: BatterySourceKind;
}

export interface LiveBatteryState {
  /** Last real or manual reading. */
  anchor: BatteryReading;
  /** Odometer (trip km) at the time of the anchor. */
  anchorKm: number;
  /** Trip distance so far. */
  tripKm: number;
  /** Consumption currently used for estimates. */
  whPerKm: number;
  /** Learned consumption from real readings, if any. */
  learnedWhPerKm?: number;
  /** How many real readings fed the learned value. */
  learnSamples: number;
}

/** Ignore learning from very short stretches; the % resolution is too coarse. */
export const MIN_LEARN_KM = 3;
/** How much a new observation moves the learned value (exponential average). */
export const LEARN_WEIGHT = 0.35;

export function startLiveBattery(percent: number, whPerKm: number, source: BatterySourceKind = 'manual', at = Date.now()): LiveBatteryState {
  return { anchor: { percent, at, source }, anchorKm: 0, tripKm: 0, whPerKm, learnSamples: 0 };
}

/** Add distance driven (from GPS). */
export function addDistance(state: LiveBatteryState, km: number): LiveBatteryState {
  return km > 0 ? { ...state, tripKm: state.tripKm + km } : state;
}

/** Current battery %: the last reading minus the estimated use since then. */
export function currentPercent(state: LiveBatteryState, vehicle: Vehicle): number {
  const kmSince = state.tripKm - state.anchorKm;
  const used = ((kmSince * state.whPerKm) / 1000 / vehicle.usableKwh) * 100;
  return Math.max(0, state.anchor.percent - used);
}

/** A real reading arrived from the car (or the driver corrected the value). */
export function applyReading(state: LiveBatteryState, reading: BatteryReading, vehicle: Vehicle): LiveBatteryState {
  const kmSince = state.tripKm - state.anchorKm;
  let { learnedWhPerKm, learnSamples, whPerKm } = state;
  const isReal = reading.source === 'car' || reading.source === 'cloud' || reading.source === 'obd';
  const drop = state.anchor.percent - reading.percent;
  if (isReal && kmSince >= MIN_LEARN_KM && drop > 0) {
    const observed = ((drop / 100) * vehicle.usableKwh * 1000) / kmSince;
    // Ignore obviously wrong values (charging happened, or a sensor glitch).
    if (observed > 60 && observed < 600) {
      learnedWhPerKm = learnedWhPerKm == null ? observed : learnedWhPerKm * (1 - LEARN_WEIGHT) + observed * LEARN_WEIGHT;
      learnSamples += 1;
      whPerKm = learnedWhPerKm;
    }
  }
  return { ...state, anchor: reading, anchorKm: state.tripKm, whPerKm, learnedWhPerKm, learnSamples };
}

/**
 * Turns what we learned on this drive into a personal correction factor
 * for the car, blended with what we knew before. The factor carries over to
 * other trips and conditions: a car that used 8% more than predicted on the
 * highway will likely use more in town too.
 */
export function updateConsumptionFactor(previous: number | undefined, state: LiveBatteryState, modelWhPerKm: number): number | undefined {
  if (state.learnedWhPerKm == null || state.learnSamples === 0) return previous;
  const observed = Math.min(1.5, Math.max(0.7, state.learnedWhPerKm / modelWhPerKm));
  if (previous == null) return observed;
  const weight = Math.min(0.5, 0.15 * state.learnSamples);
  return previous * (1 - weight) + observed * weight;
}

/**
 * Should the trip plan be recalculated? Yes when the battery is clearly off
 * from what the plan expected at this point, or after enough distance that
 * charger availability may have changed.
 */
export function shouldReplan(args: { expectedPercent: number; actualPercent: number; kmSinceLastPlan: number; minutesSinceLastPlan: number }): boolean {
  return Math.abs(args.expectedPercent - args.actualPercent) >= 3 || args.kmSinceLastPlan >= 25 || args.minutesSinceLastPlan >= 15;
}
