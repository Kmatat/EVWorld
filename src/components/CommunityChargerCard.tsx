import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { COMMUNITY_PLUG_CONNECTOR, COMMUNITY_PLUG_LABEL, CommunityCharger, describeAvailability, isAvailableAt } from '@/core/community';
import { formatKm } from '@/core/geo';
import { Vehicle } from '@/core/types';
import { colors, space } from '@/theme';

import { Badge, Card, Row, Stars } from './ui';

/** Does the car fit this community charger? A wall socket fits any car that carries a portable charger. */
export function communityFits(c: CommunityCharger, v: Vehicle): 'yes' | 'portable' | 'no' {
  const need = COMMUNITY_PLUG_CONNECTOR[c.plug];
  if (need === 'any') return 'portable';
  return v.acConnector === need ? 'yes' : 'no';
}

export default function CommunityChargerCard({ charger, vehicle, distanceKm, now = new Date() }: { charger: CommunityCharger; vehicle: Vehicle; distanceKm?: number; now?: Date }) {
  const fit = communityFits(charger, vehicle);
  const open = isAvailableAt(charger.availability, now);
  return (
    <Card onPress={() => router.push(`/community/${charger.id}`)} style={{ padding: space.md, borderLeftWidth: 3, borderLeftColor: colors.purple }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: space.sm }}>
          <Row gap={6}>
            <Ionicons name="home" size={13} color={colors.purple} />
            <Text style={styles.kicker}>Community charger</Text>
          </Row>
          <Text style={styles.name}>{charger.title}</Text>
          <Row gap={6} style={{ marginTop: 2 }}>
            <Text style={styles.meta}>Hosted by {charger.hostName}</Text>
            <Stars rating={charger.hostRating} reviews={charger.hostSessions} />
          </Row>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {distanceKm != null ? <Text style={styles.distance}>{formatKm(distanceKm)}</Text> : null}
          <Badge label={open ? 'Open now' : 'Closed now'} tone={open ? 'green' : 'gray'} />
        </View>
      </Row>
      <Text style={styles.plug}>
        {COMMUNITY_PLUG_LABEL[charger.plug]} · {charger.powerKw} kW
      </Text>
      <Row style={{ marginTop: 8, flexWrap: 'wrap' }} gap={6}>
        <Badge label={`EGP ${charger.pricePerKwh}/kWh`} tone="purple" />
        <Badge label={describeAvailability(charger.availability)} tone="gray" icon="time-outline" />
        {fit === 'yes' ? <Badge label="Fits your car" tone="green" icon="checkmark-circle" /> : fit === 'portable' ? <Badge label="Bring your portable charger" tone="amber" /> : <Badge label="Plug doesn't fit your car" tone="amber" icon="warning-outline" />}
        {charger.showApproximate ? <Badge label="Approximate location" tone="gray" icon="eye-off-outline" /> : null}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, fontWeight: '700', color: colors.purple, textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 2 },
  meta: { fontSize: 12, color: colors.muted },
  distance: { fontSize: 14, fontWeight: '700', color: colors.ink },
  plug: { fontSize: 12, color: colors.inkSoft, marginTop: 8 },
});
