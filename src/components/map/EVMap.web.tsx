import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline, Rect } from 'react-native-svg';

import { ROAD_NODES, ROAD_SEGMENTS } from '@/core/roads';
import { LatLng } from '@/core/types';
import { colors, radius } from '@/theme';

import { CITY_LABELS, EGYPT_OUTLINE, NILE, NILE_DAMIETTA, NILE_ROSETTA, SUEZ_CANAL } from './egyptShapes';
import { EVMapProps, MapPin } from './types';

/**
 * Offline map for the web preview: a simplified drawing of Egypt with the
 * main highways. It needs no map tiles or API key, so the demo runs anywhere.
 * The phone app uses real Apple / Google maps instead (EVMap.tsx).
 */

const MIN_SPAN_DEG = 0.12;

function viewFor(points: LatLng[]) {
  const pts = points.length ? points : [{ lat: 26.8, lng: 30.8 }];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    cLat: (minLat + maxLat) / 2,
    cLng: (minLng + maxLng) / 2,
    spanLat: Math.max(MIN_SPAN_DEG, maxLat - minLat),
    spanLng: Math.max(MIN_SPAN_DEG, maxLng - minLng),
  };
}

export default function EVMap({ pins, path, height = 280, onPinPress, fit }: EVMapProps) {
  const [width, setWidth] = useState(0);
  const fitPoints = fit?.length ? fit : pins.map((p) => p.location);
  const fitKey = fitPoints.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => viewFor(fitPoints), [fitKey]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetAtGrant = useRef({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [base]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          offsetAtGrant.current = offsetRef.current;
        },
        onPanResponderMove: (_, g) => setOffset({ x: offsetAtGrant.current.x + g.dx, y: offsetAtGrant.current.y + g.dy }),
      }),
    [],
  );

  const cos = Math.cos((base.cLat * Math.PI) / 180);
  const k = width > 0 ? Math.min((width * 0.82) / (base.spanLng * cos), (height * 0.78) / base.spanLat) * zoom : 1;
  const project = (lat: number, lng: number) => ({
    x: width / 2 + (lng - base.cLng) * k * cos + offset.x,
    y: height / 2 - (lat - base.cLat) * k + offset.y,
  });
  const toPath = (pts: [number, number][], close = false) =>
    pts.map(([lat, lng], i) => {
      const p = project(lat, lng);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + (close ? ' Z' : '');
  const toPoints = (pts: LatLng[]) => pts.map((p) => project(p.lat, p.lng)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const nodeIndex = new Map(ROAD_NODES.map((n) => [n.id, n.at]));
  const inView = (p: { x: number; y: number }, m = 20) => p.x > -m && p.x < width + m && p.y > -m && p.y < height + m;
  const showMinorLabels = k > 45;
  const showDistricts = k > 260;

  // Draw stations first, then route stops, start and destination on top.
  const order: Record<MapPin['kind'], number> = { station: 0, stop: 1, origin: 2, destination: 3 };
  const sortedPins = [...pins].sort((a, b) => order[a.kind] - order[b.kind]);

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={width} height={height} fill={colors.map.sea} />
            <Path d={toPath(EGYPT_OUTLINE, true)} fill={colors.map.land} stroke={colors.map.landStroke} strokeWidth={1} />
            {ROAD_SEGMENTS.map(([a, b]) => {
              const pa = nodeIndex.get(a)!;
              const pb = nodeIndex.get(b)!;
              return <Polyline key={`${a}-${b}`} points={toPoints([pa, pb])} stroke={colors.map.road} strokeWidth={1.6} fill="none" />;
            })}
            {[NILE, NILE_ROSETTA, NILE_DAMIETTA, SUEZ_CANAL].map((line, i) => (
              <Path key={i} d={toPath(line)} stroke={colors.map.nile} strokeWidth={i === 0 ? 2.5 : 1.8} fill="none" />
            ))}
            {path && path.length > 1 ? (
              <>
                <Polyline points={toPoints(path)} stroke="#fff" strokeWidth={7} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <Polyline points={toPoints(path)} stroke={colors.primary} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              </>
            ) : null}
          </Svg>

          {CITY_LABELS.filter((c) => c.rank === 1 || (c.rank === 2 && showMinorLabels) || (c.rank === 3 && showDistricts)).map((c) => {
            const p = project(c.at[0], c.at[1]);
            if (!inView(p, 0)) return null;
            return (
              <Text key={c.name} pointerEvents="none" style={[styles.cityLabel, { left: p.x + 6, top: p.y - 7 }, c.rank === 1 && { fontWeight: '700' }, c.rank === 3 && { fontSize: 10, color: '#8A826E' }]}>
                {c.name}
              </Text>
            );
          })}

          {sortedPins.map((pin) => {
            const p = project(pin.location.lat, pin.location.lng);
            if (!inView(p)) return null;
            const size = pin.kind === 'station' ? 16 : 24;
            return (
              <Pressable
                key={`${pin.kind}-${pin.id}`}
                onPress={onPinPress ? () => onPinPress(pin.id) : undefined}
                accessibilityLabel={pin.title}
                style={[
                  styles.pin,
                  { left: p.x - size / 2, top: p.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: pin.color },
                ]}
              >
                {pin.kind === 'destination' ? (
                  <Ionicons name="flag" size={12} color="#fff" />
                ) : pin.kind === 'origin' ? (
                  <View style={styles.originDot} />
                ) : pin.label ? (
                  <Text style={styles.pinLabel}>{pin.label}</Text>
                ) : (
                  <Ionicons name="flash" size={9} color="#fff" />
                )}
              </Pressable>
            );
          })}

          <View style={styles.controls}>
            <Pressable style={styles.ctrl} onPress={() => setZoom((z) => Math.min(z * 1.7, 60))} accessibilityLabel="Zoom in">
              <Ionicons name="add" size={18} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.ctrl} onPress={() => setZoom((z) => Math.max(z / 1.7, 0.2))} accessibilityLabel="Zoom out">
              <Ionicons name="remove" size={18} color={colors.ink} />
            </Pressable>
            <Pressable
              style={styles.ctrl}
              onPress={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              accessibilityLabel="Fit to view"
            >
              <Ionicons name="scan-outline" size={16} color={colors.ink} />
            </Pressable>
          </View>
          <Text style={styles.attribution} pointerEvents="none">
            Simplified offline map · drag to pan
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.map.sea },
  cityLabel: { position: 'absolute', fontSize: 11, color: '#6B6250' },
  pin: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  pinLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
  originDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  controls: { position: 'absolute', right: 8, top: 8, gap: 6 },
  ctrl: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  attribution: { position: 'absolute', left: 8, bottom: 6, fontSize: 10, color: '#6B7280' },
});
