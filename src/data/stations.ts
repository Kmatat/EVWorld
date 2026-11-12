import { Amenity, Connector, ConnectorType, Operator, Station } from '@/core/types';

/**
 * DEMO DATA. The operators and stations below are fictional placeholders
 * on realistic routes. They show how the app works. In production this list
 * comes from charging-network integrations (OCPI / partner APIs), plus
 * crowd-sourced reports from drivers.
 */

export const OPERATORS: Operator[] = [
  { id: 'nilevolt', name: 'NileVolt (demo)', color: '#0E9F6E' },
  { id: 'kahraba', name: 'KahrabaGo (demo)', color: '#2563EB' },
  { id: 'deltaplug', name: 'DeltaPlug (demo)', color: '#9333EA' },
  { id: 'redsea', name: 'RedSea Power (demo)', color: '#E11D48' },
  { id: 'masar', name: 'Masar EV (demo)', color: '#D97706' },
];

/** "ccs2:120x2" → 2 × CCS2 plugs at 120 kW */
function plugs(spec: string): Connector[] {
  return spec.split(' ').map((part) => {
    const [type, rest] = part.split(':');
    const [power, count] = rest.split('x');
    return { type: type as ConnectorType, powerKw: Number(power), count: Number(count ?? 1) };
  });
}

function st(
  id: string,
  name: string,
  operatorId: string,
  lat: number,
  lng: number,
  city: string,
  region: string,
  address: string,
  connectorSpec: string,
  pricePerKwh: number | undefined,
  open24h: boolean,
  amenities: Amenity[],
): Station {
  return { id, name, operatorId, location: { lat, lng }, city, region, address, connectors: plugs(connectorSpec), pricePerKwh, open24h, amenities };
}

export const STATIONS: Station[] = [
  // Greater Cairo
  st('cai-01', 'Point 90 Mall Hub', 'nilevolt', 30.0206, 31.4914, 'New Cairo', 'Cairo', 'South 90th St, New Cairo', 'ccs2:60x2 type2:22x2', 11, false, ['mall', 'cafe', 'restroom']),
  st('cai-02', 'Festival City Fast Charge', 'kahraba', 30.0287, 31.4085, 'New Cairo', 'Cairo', 'Ring Rd, Cairo Festival City', 'ccs2:120x2 type2:22x4', 12.5, true, ['mall', 'restaurant', 'restroom', 'wifi']),
  st('cai-03', 'City Stars Parking B2', 'deltaplug', 30.073, 31.346, 'Nasr City', 'Cairo', 'Omar Ibn El Khattab St', 'ccs2:50x1 type2:22x4', 10, false, ['mall', 'cafe']),
  st('cai-04', 'Abbas El Akkad Station', 'masar', 30.0566, 31.3301, 'Nasr City', 'Cairo', 'Abbas El Akkad St', 'type2:11x2 gbt_ac:7x1', 5, true, ['fuel']),
  st('cai-05', 'Zamalek Riverside', 'nilevolt', 30.0626, 31.2197, 'Zamalek', 'Cairo', '26th of July Corridor', 'type2:11x2', 5.5, false, ['cafe']),
  st('cai-06', 'Maadi Corniche', 'kahraba', 29.9602, 31.2569, 'Maadi', 'Cairo', 'Corniche El Nil, Maadi', 'ccs2:60x1 gbt_dc:60x1 type2:22x2', 11, true, ['fuel', 'cafe', 'restroom']),
  st('cai-07', 'Arkan Plaza', 'deltaplug', 30.0224, 30.9787, 'Sheikh Zayed', 'Giza', '26th of July Axis, Sheikh Zayed', 'ccs2:120x2 type2:22x2', 12, false, ['mall', 'restaurant', 'restroom']),
  st('cai-08', 'Mall of Arabia Gate 3', 'masar', 30.0073, 30.9733, '6th of October', 'Giza', 'Juhayna Sq., 6th of October', 'ccs2:60x2 gbt_dc:60x2 type2:22x2', 10.5, false, ['mall', 'cafe', 'restroom']),
  st('cai-09', 'Mall of Egypt Supercharge', 'nilevolt', 29.9724, 31.0168, '6th of October', 'Giza', 'Wahat Rd, 6th of October', 'ccs2:180x4 type2:22x2', 13, true, ['mall', 'restaurant', 'restroom', 'wifi']),
  st('cai-10', 'New Capital Central', 'kahraba', 30.02, 31.76, 'New Administrative Capital', 'Cairo', 'Government District, R2', 'ccs2:120x4 gbt_dc:120x2 type2:22x4', 11.5, true, ['cafe', 'restroom', 'mosque']),
  st('cai-11', 'Madinaty Open Air Mall', 'deltaplug', 30.107, 31.639, 'Madinaty', 'Cairo', 'Open Air Mall, Madinaty', 'ccs2:60x2 type2:22x2', 10, false, ['mall', 'cafe']),
  st('cai-12', 'Heliopolis Merghany', 'masar', 30.091, 31.322, 'Heliopolis', 'Cairo', 'El Merghany St', 'type2:22x2', undefined, false, ['cafe']),

  // Cairo – Alexandria Desert Road
  st('dsr-01', 'Desert Road km 65 Rest Stop', 'nilevolt', 30.315, 30.71, 'Cairo–Alex Desert Rd', 'Desert Road', 'km 65, northbound', 'ccs2:120x2 gbt_dc:60x1 type2:22x1', 12, true, ['fuel', 'restaurant', 'restroom', 'mosque']),
  st('dsr-02', 'Wadi El Natrun Services', 'kahraba', 30.47, 30.45, 'Cairo–Alex Desert Rd', 'Desert Road', 'km 100, both directions', 'ccs2:60x2 type2:22x1', 11, true, ['fuel', 'cafe', 'restroom']),
  st('dsr-03', 'Borg El Arab Junction', 'masar', 30.84, 30.06, 'Cairo–Alex Desert Rd', 'Desert Road', 'km 165, near Borg El Arab', 'ccs2:60x1 gbt_dc:60x1', 10.5, true, ['fuel', 'restroom']),

  // Alexandria
  st('alx-01', 'San Stefano Grand Plaza', 'deltaplug', 31.2457, 29.9667, 'Alexandria', 'Alexandria', 'El Geish Rd, San Stefano', 'ccs2:50x2 type2:22x2', 10, false, ['mall', 'cafe', 'restroom']),
  st('alx-02', 'Smouha City Centre', 'nilevolt', 31.2156, 29.942, 'Alexandria', 'Alexandria', 'Smouha, near Sporting Club', 'ccs2:60x2 type2:22x2', 11, true, ['mall', 'restaurant']),
  st('alx-03', 'Montazah Gardens', 'masar', 31.285, 30.015, 'Alexandria', 'Alexandria', 'Montazah Gate', 'type2:22x2', 5.5, false, ['cafe']),

  // North Coast (Sahel)
  st('nc-01', 'Marina Gate 1', 'kahraba', 30.83, 29.07, 'Marina El Alamein', 'North Coast', 'International Coastal Rd, km 98', 'ccs2:60x2 type2:22x2', 12, true, ['fuel', 'cafe', 'restroom']),
  st('nc-02', 'New Alamein Towers', 'nilevolt', 30.83, 28.95, 'New Alamein', 'North Coast', 'Downtown New Alamein', 'ccs2:180x4 gbt_dc:120x2 type2:22x4', 13, true, ['mall', 'restaurant', 'restroom', 'wifi', 'hotel']),
  st('nc-03', 'Marassi Marina', 'deltaplug', 30.96, 28.78, 'Sidi Abdel Rahman', 'North Coast', 'Marassi Marina', 'ccs2:120x2 type2:22x2', 13.5, false, ['restaurant', 'cafe', 'restroom']),
  st('nc-04', 'Ras El Hekma km 210', 'masar', 31.15, 27.9, 'Ras El Hekma', 'North Coast', 'Coastal Rd, km 210', 'ccs2:60x1 type2:22x1', 12, true, ['fuel', 'restroom']),
  st('nc-05', 'Marsa Matrouh Corniche', 'kahraba', 31.3543, 27.2373, 'Marsa Matrouh', 'North Coast', 'Corniche, Marsa Matrouh', 'ccs2:50x1 type2:22x2', 11, false, ['cafe', 'hotel']),

  // Cairo – Sokhna & Red Sea
  st('rs-01', 'Sokhna Road km 55', 'redsea', 29.82, 31.9, 'Cairo–Sokhna Rd', 'Red Sea', 'km 55, eastbound services', 'ccs2:120x2 gbt_dc:60x1 type2:22x1', 12, true, ['fuel', 'restaurant', 'restroom', 'mosque']),
  st('rs-02', 'Porto Sokhna', 'redsea', 29.58, 32.33, 'Ain Sokhna', 'Red Sea', 'Porto Sokhna resort', 'ccs2:60x2 type2:22x2', 13, false, ['hotel', 'restaurant']),
  st('rs-03', 'Galala City', 'nilevolt', 29.42, 32.38, 'Galala', 'Red Sea', 'Galala City entrance', 'ccs2:60x2 type2:22x2', 12, true, ['cafe', 'restroom']),
  st('rs-04', 'Zafarana Lighthouse', 'redsea', 29.11, 32.65, 'Zafarana', 'Red Sea', 'Red Sea Coast Rd', 'ccs2:60x2', 12, true, ['fuel', 'restroom']),
  st('rs-05', 'Ras Gharib Oasis', 'masar', 28.36, 33.08, 'Ras Gharib', 'Red Sea', 'Red Sea Coast Rd', 'ccs2:60x1 type2:22x1', 12, true, ['fuel', 'cafe', 'mosque']),
  st('rs-06', 'El Gouna Abu Tig Marina', 'redsea', 27.395, 33.678, 'El Gouna', 'Red Sea', 'Abu Tig Marina', 'ccs2:120x2 type2:22x4', 13.5, true, ['restaurant', 'hotel', 'restroom', 'wifi']),
  st('rs-07', 'Hurghada Marina', 'kahraba', 27.22, 33.84, 'Hurghada', 'Red Sea', 'Sheraton Rd, Hurghada Marina', 'ccs2:60x2 type2:22x2', 12, true, ['restaurant', 'cafe']),
  st('rs-08', 'Safaga Port Rd', 'masar', 26.73, 33.94, 'Safaga', 'Red Sea', 'Port Road, Safaga', 'type2:22x2', 6, false, ['fuel']),
  st('rs-09', 'Marsa Alam Airport Rd', 'redsea', 25.07, 34.88, 'Marsa Alam', 'Red Sea', 'Airport Road', 'type2:22x2 ccs2:50x1', 12, false, ['hotel']),

  // Sinai
  st('sn-01', 'Ras Sudr Coastal', 'redsea', 29.59, 32.71, 'Ras Sudr', 'South Sinai', 'Ras Sudr main road', 'ccs2:60x1 type2:22x1', 12, true, ['fuel', 'restroom']),
  st('sn-02', 'El Tor City', 'masar', 28.24, 33.62, 'El Tor', 'South Sinai', 'El Tor main road', 'ccs2:60x1', 12, true, ['fuel']),
  st('sn-03', 'Naama Bay', 'redsea', 27.91, 34.33, 'Sharm El Sheikh', 'South Sinai', 'Naama Bay promenade', 'ccs2:120x2 type2:22x2', 13.5, true, ['restaurant', 'hotel', 'wifi']),
  st('sn-04', 'Dahab Lighthouse', 'redsea', 28.5, 34.515, 'Dahab', 'South Sinai', 'Lighthouse area', 'type2:22x2', 6, false, ['cafe']),

  // Delta & Canal
  st('dl-01', 'Ismailia Canal Gate', 'deltaplug', 30.6, 32.27, 'Ismailia', 'Canal', 'Cairo–Ismailia Desert Rd entrance', 'ccs2:60x2 type2:22x1', 10.5, true, ['fuel', 'restroom']),
  st('dl-02', 'Port Said Corniche', 'deltaplug', 31.26, 32.3, 'Port Said', 'Canal', 'Atef El Sadat St', 'ccs2:50x1 type2:22x2', 10, false, ['cafe']),
  st('dl-03', 'Suez Port Tawfik', 'masar', 29.97, 32.54, 'Suez', 'Canal', 'Port Tawfik', 'type2:22x2', 5.5, false, []),
  st('dl-04', 'Tanta Agri Road', 'deltaplug', 30.79, 31.0, 'Tanta', 'Delta', 'Cairo–Alex Agricultural Rd', 'ccs2:60x2 gbt_dc:60x1', 10.5, true, ['fuel', 'restaurant']),
  st('dl-05', 'Mansoura University St', 'deltaplug', 31.04, 31.38, 'Mansoura', 'Delta', 'Gomhoreya St', 'type2:22x2', 5, false, ['cafe']),

  // Upper Egypt
  st('ue-01', 'Fayoum Entrance', 'masar', 29.31, 30.84, 'Fayoum', 'Upper Egypt', 'Cairo–Fayoum Rd', 'type2:22x2', 5, false, ['fuel']),
  st('ue-02', 'Beni Suef Bridge', 'nilevolt', 29.07, 31.1, 'Beni Suef', 'Upper Egypt', 'Eastern Desert Rd junction', 'ccs2:60x2', 11, true, ['fuel', 'restroom']),
  st('ue-03', 'Minya Corniche', 'nilevolt', 28.11, 30.75, 'Minya', 'Upper Egypt', 'Corniche El Nil', 'ccs2:60x1 type2:22x1', 11, true, ['cafe']),
  st('ue-04', 'Assiut New City', 'kahraba', 27.18, 31.18, 'Assiut', 'Upper Egypt', 'Western Desert Rd', 'ccs2:60x2', 11, true, ['fuel', 'restroom', 'mosque']),
  st('ue-05', 'Sohag Bridge', 'masar', 26.56, 31.7, 'Sohag', 'Upper Egypt', 'Sohag new bridge', 'type2:22x2', 5, false, []),
  st('ue-06', 'Luxor East Bank', 'nilevolt', 25.69, 32.64, 'Luxor', 'Upper Egypt', 'Corniche, East Bank', 'ccs2:60x2 type2:22x2', 11.5, true, ['hotel', 'restaurant']),
  st('ue-07', 'Aswan Corniche', 'kahraba', 24.09, 32.9, 'Aswan', 'Upper Egypt', 'Corniche El Nil, Aswan', 'type2:22x2', 5.5, false, ['cafe', 'hotel']),
];

export function stationById(id: string): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}

export function operatorById(id: string): Operator | undefined {
  return OPERATORS.find((o) => o.id === id);
}
