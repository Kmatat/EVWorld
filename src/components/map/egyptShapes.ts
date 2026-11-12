/**
 * Simplified outline of Egypt for the offline (web) map. Coordinates are
 * [lat, lng]. Accurate enough for orientation, not for navigation.
 */
export const EGYPT_OUTLINE: [number, number][] = [
  [31.58, 25.15], [31.61, 25.92], [31.35, 27.23], [31.21, 27.86], [31.04, 28.43], [30.84, 28.95], [30.86, 29.1],
  [31.09, 29.75], [31.2, 29.88], [31.32, 30.06], [31.47, 30.37], [31.58, 31.08], [31.52, 31.84], [31.27, 32.3],
  [31.06, 32.6], [31.1, 33.1], [31.13, 33.8], [31.32, 34.22],
  // Eastern border down to Taba, then the Gulf of Aqaba coast
  [29.5, 34.9], [28.97, 34.66], [28.5, 34.52], [28.1, 34.43], [27.86, 34.31], [27.73, 34.25],
  // Up the Gulf of Suez (Sinai side) to Suez
  [27.95, 33.9], [28.24, 33.6], [28.9, 33.18], [29.04, 33.1], [29.59, 32.7], [29.93, 32.58],
  // Down the African side of the Gulf of Suez and the Red Sea coast
  [29.97, 32.55], [29.6, 32.35], [29.42, 32.39], [29.12, 32.66], [28.36, 33.08], [27.4, 33.7], [27.25, 33.84],
  [26.73, 33.95], [26.1, 34.28], [25.07, 34.9], [23.95, 35.48], [23.0, 35.6], [22.0, 36.9],
  // Southern and western borders
  [22.0, 31.3], [22.0, 25.0], [29.0, 25.0],
];

export const NILE: [number, number][] = [
  [22.0, 31.4], [23.0, 32.4], [24.09, 32.9], [24.45, 32.93], [24.98, 32.87], [25.69, 32.64], [26.16, 32.72],
  [26.05, 32.25], [26.56, 31.7], [27.18, 31.18], [28.11, 30.75], [29.07, 31.1], [30.04, 31.23],
];

export const NILE_ROSETTA: [number, number][] = [[30.04, 31.23], [30.47, 30.93], [30.82, 30.82], [31.46, 30.4]];
export const NILE_DAMIETTA: [number, number][] = [[30.04, 31.23], [30.46, 31.18], [31.04, 31.38], [31.42, 31.81]];
export const SUEZ_CANAL: [number, number][] = [[29.95, 32.56], [30.6, 32.3], [31.27, 32.3]];

export const CITY_LABELS: { name: string; at: [number, number]; rank: 1 | 2 | 3 }[] = [
  { name: 'Cairo', at: [30.044, 31.236], rank: 1 },
  { name: 'Alexandria', at: [31.2, 29.92], rank: 1 },
  { name: 'Hurghada', at: [27.257, 33.81], rank: 1 },
  { name: 'Sharm El Sheikh', at: [27.915, 34.33], rank: 1 },
  { name: 'Luxor', at: [25.69, 32.64], rank: 1 },
  { name: 'Aswan', at: [24.09, 32.9], rank: 1 },
  { name: 'Marsa Matrouh', at: [31.354, 27.237], rank: 2 },
  { name: 'El Alamein', at: [30.83, 28.95], rank: 2 },
  { name: 'Port Said', at: [31.265, 32.3], rank: 2 },
  { name: 'Suez', at: [29.97, 32.54], rank: 2 },
  { name: 'Ain Sokhna', at: [29.6, 32.32], rank: 2 },
  { name: 'Dahab', at: [28.5, 34.51], rank: 2 },
  { name: 'Marsa Alam', at: [25.07, 34.88], rank: 2 },
  { name: 'Assiut', at: [27.18, 31.18], rank: 2 },
  { name: 'Minya', at: [28.11, 30.75], rank: 2 },
  { name: 'Ismailia', at: [30.6, 32.27], rank: 2 },
  { name: 'Tanta', at: [30.787, 31.0], rank: 2 },
  { name: 'Mansoura', at: [31.04, 31.38], rank: 2 },
  { name: 'Fayoum', at: [29.31, 30.84], rank: 2 },
  // Greater Cairo districts (shown when zoomed in)
  { name: 'New Cairo', at: [30.03, 31.47], rank: 3 },
  { name: 'Heliopolis', at: [30.091, 31.322], rank: 3 },
  { name: 'Nasr City', at: [30.056, 31.33], rank: 3 },
  { name: 'Maadi', at: [29.96, 31.257], rank: 3 },
  { name: 'Zamalek', at: [30.063, 31.22], rank: 3 },
  { name: 'Sheikh Zayed', at: [30.044, 30.983], rank: 3 },
  { name: '6th of October', at: [29.94, 30.93], rank: 3 },
  { name: 'New Capital', at: [30.02, 31.76], rank: 3 },
  { name: 'Madinaty', at: [30.107, 31.639], rank: 3 },
  { name: 'Giza Pyramids', at: [29.979, 31.134], rank: 3 },
];
