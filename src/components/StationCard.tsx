import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { compatibleConnectors, effectivePowerKw, isCompatible, maxPowerKw } from '@/core/charging';
import { formatKm } from '@/core/geo';
import { LiveStation, minutesAgo } from '@/core/stations';
import { CONNECTOR_LABEL, Station, Vehicle } from '@/core/types';
import { operatorById } from '@/data/stations';
import { colors, space } from '@/theme';

import { Badge, Card, Row } from './ui';

export function availabilityColor(live: LiveStation): string {
  if (live.offline) return colors.faint;
  if (live.availablePlugs === 0) return colors.red;
  return colors.primary;
}

export function availabilityLabel(live: LiveStation): { label: string; tone: 'green' | 'red' | 'gray' } {
  if (live.offline) return { label: 'Offline', tone: 'gray' };
  if (live.availablePlugs === 0) return { label: 'All busy', tone: 'red' };
  return { label: `${live.availablePlugs}/${live.totalPlugs} free`, tone: 'green' };
}

export function connectorSummary(station: Station): string {
  return station.connectors.map((c) => `${CONNECTOR_LABEL[c.type].split(' ')[0]} ${c.powerKw}kW×${c.count}`).join(' · ');
}

export default function StationCard({
  live,
  vehicle,
  distanceKm,
  now,
  onPress,
}: {
  live: LiveStation;
  vehicle: Vehicle;
  distanceKm?: number;
  now: number;
  onPress?: () => void;
}) {
  const { station } = live;
  const operator = operatorById(station.operatorId);
  const status = availabilityLabel(live);
  const compatible = isCompatible(vehicle, station);
  const best = compatibleConnectors(vehicle, station)[0];

  return (
    <Card onPress={onPress} style={{ padding: space.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: space.sm }}>
          <Text style={styles.name}>{station.name}</Text>
          <Row gap={6} style={{ marginTop: 2 }}>
            <View style={[styles.dot, { backgroundColor: operator?.color ?? colors.faint }]} />
            <Text style={styles.meta}>
              {operator?.name} · {station.city}
            </Text>
          </Row>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {distanceKm != null ? <Text style={styles.distance}>{formatKm(distanceKm)}</Text> : null}
          <Badge label={status.label} tone={status.tone} />
        </View>
      </Row>
      <Text style={styles.connectors}>{connectorSummary(station)}</Text>
      <Row style={{ marginTop: 8, flexWrap: 'wrap' }} gap={6}>
        <Badge label={`Up to ${maxPowerKw(station)} kW`} tone="blue" icon="flash-outline" />
        {station.pricePerKwh != null ? <Badge label={`EGP ${station.pricePerKwh}/kWh`} tone="gray" /> : <Badge label="Price n/a" tone="gray" />}
        {compatible ? (
          <Badge label={`Fits your car · ${effectivePowerKw(vehicle, best)} kW`} tone="green" icon="checkmark-circle" />
        ) : (
          <Badge label="Plug doesn't fit your car" tone="amber" icon="warning-outline" />
        )}
        {station.open24h ? <Badge label="24/7" tone="gray" /> : null}
      </Row>
      <Row gap={4} style={{ marginTop: 8 }}>
        <Ionicons name="time-outline" size={12} color={colors.faint} />
        <Text style={styles.updated}>Status updated {minutesAgo(live.updatedAt, now)}</Text>
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  distance: { fontSize: 14, fontWeight: '700', color: colors.ink },
  connectors: { fontSize: 12, color: colors.inkSoft, marginTop: 8 },
  updated: { fontSize: 11, color: colors.faint },
});
