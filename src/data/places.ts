import { Place } from '@/core/types';

/** Popular destinations across Egypt (approximate city-centre coordinates). */
export const PLACES: Place[] = [
  { id: 'downtown', name: 'Downtown Cairo (Tahrir)', region: 'Cairo', location: { lat: 30.0444, lng: 31.2357 } },
  { id: 'new-cairo', name: 'New Cairo (5th Settlement)', region: 'Cairo', location: { lat: 30.03, lng: 31.47 } },
  { id: 'heliopolis', name: 'Heliopolis', region: 'Cairo', location: { lat: 30.091, lng: 31.322 } },
  { id: 'maadi', name: 'Maadi', region: 'Cairo', location: { lat: 29.9602, lng: 31.2569 } },
  { id: 'zayed', name: 'Sheikh Zayed', region: 'Giza', location: { lat: 30.0444, lng: 30.9833 } },
  { id: 'october', name: '6th of October City', region: 'Giza', location: { lat: 29.9285, lng: 30.9188 } },
  { id: 'nac', name: 'New Administrative Capital', region: 'Cairo', location: { lat: 30.02, lng: 31.76 } },
  { id: 'alex', name: 'Alexandria', region: 'Alexandria', location: { lat: 31.2001, lng: 29.9187 } },
  { id: 'alamein', name: 'New Alamein (North Coast)', region: 'North Coast', location: { lat: 30.83, lng: 28.95 } },
  { id: 'marassi', name: 'Marassi (North Coast)', region: 'North Coast', location: { lat: 30.96, lng: 28.78 } },
  { id: 'matrouh', name: 'Marsa Matrouh', region: 'North Coast', location: { lat: 31.3543, lng: 27.2373 } },
  { id: 'sokhna', name: 'Ain Sokhna', region: 'Red Sea', location: { lat: 29.6, lng: 32.32 } },
  { id: 'gouna', name: 'El Gouna', region: 'Red Sea', location: { lat: 27.394, lng: 33.678 } },
  { id: 'hurghada', name: 'Hurghada', region: 'Red Sea', location: { lat: 27.2579, lng: 33.8116 } },
  { id: 'marsa-alam', name: 'Marsa Alam', region: 'Red Sea', location: { lat: 25.0676, lng: 34.879 } },
  { id: 'sharm', name: 'Sharm El Sheikh', region: 'South Sinai', location: { lat: 27.9158, lng: 34.33 } },
  { id: 'dahab', name: 'Dahab', region: 'South Sinai', location: { lat: 28.5091, lng: 34.5136 } },
  { id: 'ismailia', name: 'Ismailia', region: 'Canal', location: { lat: 30.5965, lng: 32.2715 } },
  { id: 'port-said', name: 'Port Said', region: 'Canal', location: { lat: 31.2653, lng: 32.3019 } },
  { id: 'mansoura', name: 'Mansoura', region: 'Delta', location: { lat: 31.0409, lng: 31.3785 } },
  { id: 'tanta', name: 'Tanta', region: 'Delta', location: { lat: 30.7865, lng: 31.0004 } },
  { id: 'fayoum', name: 'Fayoum', region: 'Upper Egypt', location: { lat: 29.3084, lng: 30.8428 } },
  { id: 'luxor', name: 'Luxor', region: 'Upper Egypt', location: { lat: 25.6872, lng: 32.6396 } },
  { id: 'aswan', name: 'Aswan', region: 'Upper Egypt', location: { lat: 24.0889, lng: 32.8998 } },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}
