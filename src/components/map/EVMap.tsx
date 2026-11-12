import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { LatLng } from '@/core/types';
import { colors, radius } from '@/theme';

import { EVMapProps } from './types';

/**
 * Phone map (iOS: Apple Maps, Android: Google Maps). The web preview uses
 * EVMap.web.tsx instead. Production Android builds need a Google Maps API
 * key in app.json.
 */

const toLL = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

function regionFor(points: LatLng[]) {
  const pts = points.length ? points : [{ lat: 30.0444, lng: 31.2357 }];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.4),
  };
}

export default function EVMap({ pins, path, height = 280, onPinPress, fit }: EVMapProps) {
  const ref = useRef<MapView>(null);
  const fitPoints = fit?.length ? fit : pins.map((p) => p.location);
  const fitKey = fitPoints.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialRegion = useMemo(() => regionFor(fitPoints), []);

  useEffect(() => {
    if (fitPoints.length > 1) {
      ref.current?.fitToCoordinates(fitPoints.map(toLL), { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    } else {
      ref.current?.animateToRegion(regionFor(fitPoints), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView ref={ref} style={StyleSheet.absoluteFill} initialRegion={initialRegion} showsUserLocation toolbarEnabled={false}>
        {path && path.length > 1 ? <Polyline coordinates={path.map(toLL)} strokeColor={colors.primary} strokeWidth={4} /> : null}
        {pins.map((pin) => (
          <Marker
            key={`${pin.kind}-${pin.id}`}
            coordinate={toLL(pin.location)}
            title={pin.title}
            onPress={onPinPress ? () => onPinPress(pin.id) : undefined}
            tracksViewChanges={false}
          >
            <View style={[styles.pin, { backgroundColor: pin.color }, pin.kind !== 'station' && styles.bigPin]}>
              {pin.kind === 'destination' ? (
                <Ionicons name="flag" size={12} color="#fff" />
              ) : pin.label ? (
                <Text style={styles.pinLabel}>{pin.label}</Text>
              ) : (
                <Ionicons name="flash" size={10} color="#fff" />
              )}
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.map.sea },
  pin: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  bigPin: { width: 26, height: 26, borderRadius: 13 },
  pinLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
