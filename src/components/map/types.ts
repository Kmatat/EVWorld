import { LatLng } from '@/core/types';

export type PinKind = 'station' | 'origin' | 'destination' | 'stop';

export interface MapPin {
  id: string;
  location: LatLng;
  kind: PinKind;
  color: string;
  /** Short text shown inside the pin (e.g. stop number). */
  label?: string;
  title?: string;
}

export interface EVMapProps {
  pins: MapPin[];
  /** Line to draw (e.g. the trip route). */
  path?: LatLng[];
  height?: number;
  onPinPress?: (id: string) => void;
  /** Points the map should zoom to fit. Defaults to all pins. */
  fit?: LatLng[];
}
