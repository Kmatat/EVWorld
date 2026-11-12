import { Vehicle } from '@/core/types';

/**
 * EVs commonly seen on Egyptian roads, with approximate specs for a typical
 * trim. Specs differ by trim and by market (China-spec imports use GB/T
 * plugs), so users can also enter a custom vehicle.
 */
export const VEHICLES: Vehicle[] = [
  { id: 'byd-atto3', make: 'BYD', model: 'Atto 3 (60.5 kWh)', usableKwh: 60.5, wltpKm: 420, maxDcKw: 88, maxAcKw: 7, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'byd-dolphin', make: 'BYD', model: 'Dolphin (60 kWh)', usableKwh: 60.4, wltpKm: 427, maxDcKw: 88, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'byd-seal', make: 'BYD', model: 'Seal (82.5 kWh)', usableKwh: 82.5, wltpKm: 570, maxDcKw: 150, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'mg4', make: 'MG', model: 'MG4 Electric (64 kWh)', usableKwh: 61.7, wltpKm: 435, maxDcKw: 135, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'mg-zs', make: 'MG', model: 'ZS EV Long Range', usableKwh: 68.3, wltpKm: 440, maxDcKw: 92, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'hyundai-ioniq5', make: 'Hyundai', model: 'Ioniq 5 (77 kWh)', usableKwh: 74, wltpKm: 507, maxDcKw: 230, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'hyundai-kona', make: 'Hyundai', model: 'Kona Electric (65 kWh)', usableKwh: 64.8, wltpKm: 514, maxDcKw: 102, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'kia-ev6', make: 'Kia', model: 'EV6 (77 kWh)', usableKwh: 74, wltpKm: 528, maxDcKw: 230, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'tesla-m3', make: 'Tesla', model: 'Model 3 RWD', usableKwh: 57.5, wltpKm: 513, maxDcKw: 170, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'tesla-my', make: 'Tesla', model: 'Model Y Long Range', usableKwh: 75, wltpKm: 533, maxDcKw: 250, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'bmw-ix3', make: 'BMW', model: 'iX3', usableKwh: 74, wltpKm: 460, maxDcKw: 150, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'bmw-i4', make: 'BMW', model: 'i4 eDrive40', usableKwh: 80.7, wltpKm: 590, maxDcKw: 205, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'mercedes-eqa', make: 'Mercedes-Benz', model: 'EQA 250', usableKwh: 66.5, wltpKm: 430, maxDcKw: 100, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'vw-id4-eu', make: 'Volkswagen', model: 'ID.4 Pro (EU spec)', usableKwh: 77, wltpKm: 520, maxDcKw: 135, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' },
  { id: 'vw-id4-cn', make: 'Volkswagen', model: 'ID.4 Crozz (China spec)', usableKwh: 79, wltpKm: 500, maxDcKw: 100, maxAcKw: 7, acConnector: 'gbt_ac', dcConnector: 'gbt_dc', note: 'China-spec import, uses GB/T plugs' },
  { id: 'nissan-leaf', make: 'Nissan', model: 'Leaf 40 kWh', usableKwh: 39, wltpKm: 270, maxDcKw: 50, maxAcKw: 6.6, acConnector: 'type2', dcConnector: 'chademo' },
];

export const DEFAULT_VEHICLE_ID = 'byd-atto3';

export function vehicleById(id: string): Vehicle | undefined {
  return VEHICLES.find((v) => v.id === id);
}
