import { Linking } from 'react-native';

import { LatLng } from '@/core/types';
import { PLACES, placeById } from '@/data/places';
import { stationById } from '@/data/stations';

/** Trip endpoints can be a city/place ("alex") or a charger ("station:cai-01"). */
export function resolveLocation(id: string | undefined): { name: string; location: LatLng } | undefined {
  if (!id) return undefined;
  if (id.startsWith('station:')) {
    const s = stationById(id.slice('station:'.length));
    return s ? { name: s.name, location: s.location } : undefined;
  }
  const p = placeById(id);
  return p ? { name: p.name, location: p.location } : undefined;
}

export { PLACES };

/** Opens Google Maps turn-by-turn navigation (app if installed, otherwise the website). */
export function openNavigation(destination: LatLng, origin?: LatLng, waypoints: LatLng[] = []) {
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({ api: '1', destination: fmt(destination), travelmode: 'driving' });
  if (origin) params.set('origin', fmt(origin));
  if (waypoints.length) params.set('waypoints', waypoints.map(fmt).join('|'));
  Linking.openURL(`https://www.google.com/maps/dir/?${params.toString()}`).catch(() => {});
}
