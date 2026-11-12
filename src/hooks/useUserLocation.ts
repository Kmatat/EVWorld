import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { LatLng } from '@/core/types';

/** Default start point when GPS is unavailable: Tahrir Square, Cairo. */
export const CAIRO: LatLng = { lat: 30.0444, lng: 31.2357 };

const insideEgypt = (p: LatLng) => p.lat > 21.5 && p.lat < 32 && p.lng > 24.5 && p.lng < 37.2;

type Source = 'default' | 'gps' | 'outside_egypt' | 'denied';

const useLocationStore = create<{ location: LatLng; source: Source; loading: boolean; set: (s: Partial<{ location: LatLng; source: Source; loading: boolean }>) => void }>(
  (set) => ({ location: CAIRO, source: 'default', loading: false, set }),
);

/**
 * The driver's position. Falls back to Cairo when permission is denied, or
 * when the device is outside Egypt (the demo data only covers Egypt).
 */
export function useUserLocation({ auto = Platform.OS !== 'web' }: { auto?: boolean } = {}) {
  const { location, source, loading, set } = useLocationStore();

  const request = useCallback(async () => {
    set({ loading: true });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ source: 'denied', location: CAIRO });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (insideEgypt(here)) set({ location: here, source: 'gps' });
      else set({ location: CAIRO, source: 'outside_egypt' });
    } catch {
      set({ source: 'denied', location: CAIRO });
    } finally {
      set({ loading: false });
    }
  }, [set]);

  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (auto && !asked && source === 'default') {
      setAsked(true);
      request();
    }
  }, [auto, asked, source, request]);

  const label =
    source === 'gps'
      ? 'Your location'
      : source === 'outside_egypt'
        ? 'Cairo (you appear to be outside Egypt)'
        : 'Cairo (default — tap to use GPS)';

  return { location, source, loading, request, label };
}
