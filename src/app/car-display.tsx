import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import EVMap from '@/components/map/EVMap';
import { Banner, Chip, Row, Screen, text } from '@/components/ui';
import { ANDROID_AUTO_MAX_ROWS, CARPLAY_MAX_POIS, chargerPoiScreen, tripInfoScreen } from '@/core/carScreens';
import { currentPercent } from '@/core/liveBattery';
import { planTrip } from '@/core/tripPlanner';
import { STATIONS } from '@/data/stations';
import { useNow } from '@/hooks/useNow';
import { useUserLocation } from '@/hooks/useUserLocation';
import { linkLabel } from '@/services/vehicleData';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { useDriveStore } from '@/store/useDriveStore';
import { colors, radius } from '@/theme';
import { resolveLocation } from '@/utils/locations';

/**
 * What EVWorld shows on the car's screen. It uses the same screen objects
 * (src/core/carScreens.ts) that the native CarPlay / Android Auto adapter
 * draws with the platforms' own templates.
 */
export default function CarDisplayPreview() {
  const [platform, setPlatform] = useState<'carplay' | 'android'>('carplay');
  const [view, setView] = useState<'chargers' | 'trip'>('trip');
  const vehicle = useVehicle();
  const now = useNow();
  const gps = useUserLocation({ auto: false });
  const drive = useDriveStore();
  const app = useAppStore();

  const position = drive.active && drive.position ? drive.position : gps.location;
  const poi = chargerPoiScreen(STATIONS, vehicle, position, now, platform === 'carplay' ? CARPLAY_MAX_POIS : ANDROID_AUTO_MAX_ROWS);

  const destination = drive.active ? drive.destination : resolveLocation(app.destinationPlaceId);
  const battery = drive.active && drive.live ? currentPercent(drive.live, vehicle) : app.batteryPercent;
  const plan = useMemo(() => {
    if (drive.active && drive.plan) return drive.plan;
    if (!destination) return undefined;
    return planTrip({ vehicle, batteryPercent: battery, origin: position, destination: destination.location, conditions: app.conditions, stations: STATIONS, reservePercent: app.reservePercent, consumptionFactor: app.consumptionFactor[vehicle.id], now });
  }, [drive.active, drive.plan, destination?.location.lat, battery, position.lat, app.conditions, vehicle.id, now]);
  const liveRange = drive.active && drive.live && plan ? (Math.max(0, battery - plan.reservePercent) / 100) * vehicle.usableKwh * 1000 / drive.live.whPerKm : undefined;
  const info =
    plan && destination
      ? tripInfoScreen({
          plan,
          batteryPercent: battery,
          batterySourceLabel: drive.active ? linkLabel(app.vehicleLink) : 'set by you',
          kmDriven: drive.tripKm,
          destinationName: destination.name.split(' (')[0],
          rangeKm: liveRange,
          doneStopIds: drive.active ? drive.chargedAt : [],
          progressKm: drive.active ? drive.legKm : 0,
        })
      : undefined;

  const dark = platform === 'carplay';
  const fg = dark ? '#F9FAFB' : '#E8EAED';
  const sub = dark ? '#9CA3AF' : '#9AA0A6';
  const accent = dark ? '#30D158' : '#8AB4F8';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Car screen preview' }} />
      <Row gap={6}>
        <Chip label="Apple CarPlay" icon="logo-apple" selected={platform === 'carplay'} onPress={() => setPlatform('carplay')} />
        <Chip label="Android Auto" icon="logo-android" selected={platform === 'android'} onPress={() => setPlatform('android')} />
      </Row>
      <Row gap={6}>
        <Chip label="Trip" selected={view === 'trip'} onPress={() => setView('trip')} />
        <Chip label="Chargers" selected={view === 'chargers'} onPress={() => setView('chargers')} />
      </Row>

      <View style={[styles.unit, { backgroundColor: dark ? '#000' : '#202124' }]}>
        <View style={[styles.rail, { backgroundColor: dark ? '#1C1C1E' : '#303134' }]}>
          <Text style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
          <Ionicons name="flash" size={22} color={accent} />
          <Ionicons name="musical-notes" size={20} color={sub} />
          <Ionicons name="call" size={20} color={sub} />
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1.1, padding: 10 }}>
            {view === 'trip' && info ? (
              <>
                <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {info.title}
                </Text>
                {info.rows.map((r) => (
                  <View key={r.label} style={[styles.row, { borderColor: dark ? '#2C2C2E' : '#3C4043' }]}>
                    <Text style={{ color: sub, fontSize: 11 }}>{r.label}</Text>
                    <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {r.value}
                    </Text>
                  </View>
                ))}
                <Row gap={6} style={{ marginTop: 8 }}>
                  {info.actions.map((a) => (
                    <View key={a.id} style={[styles.action, { backgroundColor: a.id === 'navigate' ? accent : dark ? '#2C2C2E' : '#3C4043' }]}>
                      <Text style={{ color: a.id === 'navigate' ? '#000' : fg, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                        {a.title}
                      </Text>
                    </View>
                  ))}
                </Row>
              </>
            ) : view === 'trip' ? (
              <Text style={{ color: sub }}>Choose a destination in the Trip tab.</Text>
            ) : (
              <>
                <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{poi.title}</Text>
                {poi.items.slice(0, platform === 'carplay' ? 5 : ANDROID_AUTO_MAX_ROWS).map((p, i) => (
                  <View key={p.id} style={[styles.row, { borderColor: dark ? '#2C2C2E' : '#3C4043', flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <View style={[styles.num, { backgroundColor: p.available ? accent : '#6B7280' }]}>
                      <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                        {p.title}
                      </Text>
                      <Text style={{ color: sub, fontSize: 11 }} numberOfLines={1}>
                        {p.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
          <View style={{ flex: 1, padding: 6 }}>
            <EVMap
              pins={[
                ...(view === 'chargers'
                  ? poi.items.map((p, i) => ({ id: p.id, location: p.location, kind: 'stop' as const, color: p.available ? colors.primary : colors.faint, label: String(i + 1) }))
                  : (plan?.stops ?? []).filter((s) => !drive.active || !drive.chargedAt.includes(s.station.id)).map((s, i) => ({ id: s.station.id, location: s.station.location, kind: 'stop' as const, color: colors.amber, label: String(i + 1) }))),
                { id: 'me', location: position, kind: 'origin', color: colors.blue },
              ]}
              path={view === 'trip' && drive.active ? drive.route : undefined}
              fit={view === 'chargers' ? [position, ...poi.items.slice(0, 4).map((p) => p.location)] : destination ? [position, destination.location] : [position]}
              height={210}
            />
          </View>
        </View>
      </View>

      <Banner
        icon="information-circle-outline"
        text={
          platform === 'carplay'
            ? "CarPlay apps must use Apple's templates (a charger map with up to 12 points, and an information panel). Apple must approve the app for its EV-charging category. Battery % on iPhone comes from a car account or OBD dongle."
            : 'Android Auto apps use Google\'s templates (place list + map, about 6 rows while driving). The app can also read the battery % from cars that share it with Android Auto.'
        }
      />
      <Text style={[text.small, { textAlign: 'center' }]}>Tapping "Navigate" on the car screen opens the car's navigation app (Apple Maps, Google Maps or Waze).</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  unit: { flexDirection: 'row', borderRadius: radius.lg, overflow: 'hidden', minHeight: 230, borderWidth: 6, borderColor: '#111' },
  rail: { width: 46, alignItems: 'center', paddingVertical: 10, gap: 18 },
  row: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8, alignItems: 'center' },
  num: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

