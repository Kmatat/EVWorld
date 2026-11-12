import { clampPercent } from './range';
import { Connector, ConnectorType, Station, Vehicle, isDcConnector } from './types';

/**
 * CHARGING MODEL
 * ==============
 * Batteries do not charge at a constant speed. DC fast charging is fastest
 * when the battery is low. It slows down a lot above ~80% to protect the
 * battery. That is why the planner usually recommends "charge to 80% and go".
 *
 * The real speed is limited by whichever is lower: the charger's power or
 * the maximum the car accepts.
 */

/** Share of peak power actually delivered at a given battery % (DC). */
export function dcTaper(soc: number): number {
  if (soc < 50) return 0.92;
  if (soc < 80) return 0.72;
  if (soc < 90) return 0.42;
  return 0.22;
}

/** AC charging is almost flat; it only slows near full. */
export function acTaper(soc: number): number {
  return soc < 95 ? 0.95 : 0.6;
}

/** Energy lost as heat while charging. The charger bills for it too. */
export const CHARGING_LOSS = 0.08;

/** Does the car have a socket that matches this connector? */
export function vehicleAccepts(vehicle: Vehicle, type: ConnectorType): boolean {
  return vehicle.acConnector === type || vehicle.dcConnector === type;
}

/** Connectors at a station the car can plug into, best (fastest effective) first. */
export function compatibleConnectors(vehicle: Vehicle, station: Station): Connector[] {
  return station.connectors
    .filter((c) => vehicleAccepts(vehicle, c.type))
    .sort((a, b) => effectivePowerKw(vehicle, b) - effectivePowerKw(vehicle, a));
}

export function isCompatible(vehicle: Vehicle, station: Station): boolean {
  return compatibleConnectors(vehicle, station).length > 0;
}

/** Peak power the car will actually get from this connector. */
export function effectivePowerKw(vehicle: Vehicle, connector: Connector): number {
  return isDcConnector(connector.type)
    ? Math.min(connector.powerKw, vehicle.maxDcKw)
    : Math.min(connector.powerKw, vehicle.maxAcKw);
}

/** Minutes to charge from one % to another on a given connector. */
export function chargeMinutes(vehicle: Vehicle, connector: Connector, fromPercent: number, toPercent: number): number {
  const from = clampPercent(fromPercent);
  const to = clampPercent(toPercent);
  if (to <= from) return 0;
  const peak = effectivePowerKw(vehicle, connector);
  if (peak <= 0) return Infinity;
  const taper = isDcConnector(connector.type) ? dcTaper : acTaper;
  const kwhPerPercent = vehicle.usableKwh / 100;
  let hours = 0;
  // Add up the time for each 1% step (handles fractional start/end).
  let soc = from;
  while (soc < to) {
    const next = Math.min(to, Math.floor(soc) + 1);
    hours += (kwhPerPercent * (next - soc)) / (peak * taper(soc) * (1 - CHARGING_LOSS));
    soc = next;
  }
  return hours * 60;
}

/** kWh the charger will bill for (energy into the battery + losses). */
export function billedKwh(vehicle: Vehicle, fromPercent: number, toPercent: number): number {
  const added = (vehicle.usableKwh * Math.max(0, clampPercent(toPercent) - clampPercent(fromPercent))) / 100;
  return added / (1 - CHARGING_LOSS);
}

export function chargeCostEgp(vehicle: Vehicle, station: Station, fromPercent: number, toPercent: number): number | undefined {
  if (station.pricePerKwh == null) return undefined;
  return billedKwh(vehicle, fromPercent, toPercent) * station.pricePerKwh;
}

/** Highest power on site, for display ("up to 120 kW"). */
export function maxPowerKw(station: Station): number {
  return Math.max(...station.connectors.map((c) => c.powerKw));
}

export function hasDc(station: Station): boolean {
  return station.connectors.some((c) => isDcConnector(c.type));
}
