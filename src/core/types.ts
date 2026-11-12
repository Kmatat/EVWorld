/**
 * Shared types for the EVWorld core engine.
 *
 * The "core" folder is plain TypeScript with no UI code, so the same
 * logic can run in the mobile app, on a server, or in tests.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Plug standards found in Egypt. GB/T matters because many cars are imported from China. */
export type ConnectorType = 'type2' | 'ccs2' | 'gbt_ac' | 'gbt_dc' | 'chademo';

export const CONNECTOR_LABEL: Record<ConnectorType, string> = {
  type2: 'Type 2 (AC)',
  ccs2: 'CCS2 (DC)',
  gbt_ac: 'GB/T (AC)',
  gbt_dc: 'GB/T (DC)',
  chademo: 'CHAdeMO (DC)',
};

export const DC_CONNECTORS: ConnectorType[] = ['ccs2', 'gbt_dc', 'chademo'];

export const isDcConnector = (c: ConnectorType) => DC_CONNECTORS.includes(c);

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  /** Battery energy the driver can actually use, in kWh. */
  usableKwh: number;
  /** Official WLTP range in km (lab test, optimistic). */
  wltpKm: number;
  /** Peak DC fast-charging power the car accepts, in kW. */
  maxDcKw: number;
  /** Max AC charging power of the on-board charger, in kW. */
  maxAcKw: number;
  acConnector: ConnectorType;
  dcConnector: ConnectorType | null;
  /** Free-text note, e.g. "China-spec import". */
  note?: string;
}

export type ConnectorStatus = 'available' | 'occupied' | 'offline';

export interface Connector {
  type: ConnectorType;
  powerKw: number;
  /** How many plugs of this type exist at the site. */
  count: number;
}

export interface LiveConnector extends Connector {
  available: number;
  occupied: number;
  offline: number;
}

export type Amenity = 'cafe' | 'restroom' | 'mall' | 'mosque' | 'wifi' | 'restaurant' | 'fuel' | 'hotel';

export interface Station {
  id: string;
  name: string;
  operatorId: string;
  location: LatLng;
  city: string;
  address: string;
  connectors: Connector[];
  /** Price in EGP per kWh. Undefined when the operator does not publish it. */
  pricePerKwh?: number;
  open24h: boolean;
  amenities: Amenity[];
  /** Region tag, used for grouping in the UI. */
  region: string;
}

export interface Operator {
  id: string;
  name: string;
  color: string;
}

export type RouteProfile = 'city' | 'mixed' | 'highway';
export type DrivingStyle = 'eco' | 'normal' | 'sporty';

export interface DrivingConditions {
  profile: RouteProfile;
  /** Outside temperature in °C. */
  temperatureC: number;
  /** Air-conditioning / heating on. */
  climateOn: boolean;
  style: DrivingStyle;
  /** People in the car, including the driver. */
  passengers: number;
}

export interface Place {
  id: string;
  name: string;
  region: string;
  location: LatLng;
}
