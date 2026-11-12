import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import EVMap from '@/components/map/EVMap';
import { MapPin } from '@/components/map/types';
import { Badge, Banner, BatteryBar, Button, Card, Chip, Row, Screen, Stepper, text } from '@/components/ui';
import { formatDuration, formatKm } from '@/core/geo';
import { currentPercent } from '@/core/liveBattery';
import { AVERAGE_SPEED_KMH } from '@/core/range';
import { linkLabel, subscribeAndroidAuto } from '@/services/vehicleData';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { useDriveStore } from '@/store/useDriveStore';
import { colors, radius, space } from '@/theme';
import { openNavigation } from '@/utils/locations';

export default function DriveScreen() {
  const vehicle = useVehicle();
  const drive = useDriveStore();
  const link = useAppStore((s) => s.vehicleLink);
  const conditions = useAppStore((s) => s.conditions);
  const autoConditions = useAppStore((s) => s.autoConditions);
  const [correcting, setCorrecting] = useState(false);
  const [corrected, setCorrected] = useState(50);

  // Demo simulator clock.
  useEffect(() => {
    if (!drive.simulating) return;
    const id = setInterval(() => useDriveStore.getState().tick(1), 1000);
    return () => clearInterval(id);
  }, [drive.simulating]);

  // Real GPS distance on phones (foreground). Background tracking needs extra permission.
  useEffect(() => {
    if (!drive.active || drive.simulating || drive.finished || Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 50, timeInterval: 5000 }, (p) =>
        useDriveStore.getState().gpsUpdate({ lat: p.coords.latitude, lng: p.coords.longitude }, p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : undefined, p.timestamp),
      );
    })();
    return () => sub?.remove();
  }, [drive.active, drive.simulating, drive.finished]);

  // Battery readings from Android Auto, when the native car module is in the build.
  useEffect(() => {
    if (!drive.active || link !== 'android_auto') return;
    return subscribeAndroidAuto((s) => useDriveStore.getState().signal(s));
  }, [drive.active, link]);

  if (!drive.active || !drive.plan || !drive.live || !drive.destination) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Trip mode' }} />
        <Banner text="No trip running. Plan a trip and tap Start trip." />
        <Button title="Go to trip planner" onPress={() => router.replace('/trip')} />
      </Screen>
    );
  }

  const plan = drive.plan;
  const pct = currentPercent(drive.live, vehicle);
  const remainingKm = Math.max(0, drive.routeKm - drive.legKm);
  const next = plan.stops.find((s) => !drive.chargedAt.includes(s.station.id));
  const kmToNext = next ? Math.max(0, next.distanceFromStartKm - drive.legKm) : undefined;
  const rangeKm = (Math.max(0, pct - plan.reservePercent) / 100) * vehicle.usableKwh * 1000 / drive.live.whPerKm;
  const fromCar = drive.live.anchor.source === 'car' || drive.live.anchor.source === 'cloud' || drive.live.anchor.source === 'obd';
  const sourceText = fromCar && link !== 'manual' ? linkLabel(link) : 'estimated from distance';
  const learned = drive.live.learnedWhPerKm;
  const etaMin = (remainingKm / AVERAGE_SPEED_KMH[conditions.profile]) * 60 + plan.stops.filter((s) => !drive.chargedAt.includes(s.station.id)).reduce((m, s) => m + s.chargeMinutes, 0);

  const pins: MapPin[] = [
    ...plan.stops.map((s, i) => ({ id: s.station.id, location: s.station.location, kind: 'stop' as const, color: colors.amber, label: String(i + 1), title: s.station.name })),
    { id: 'dest', location: drive.destination.location, kind: 'destination', color: colors.red, title: drive.destination.name },
    { id: 'me', location: drive.position ?? drive.destination.location, kind: 'origin', color: colors.blue, title: 'You' },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: `To ${drive.destination.name.split(' (')[0]}` }} />
      <View style={styles.hero}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={styles.heroLabel}>Battery now</Text>
            <Text style={[styles.heroValue, { color: pct < 15 ? '#FCA5A5' : '#6EE7B7' }]}>{Math.round(pct)}%</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroLabel}>Safe range</Text>
            <Text style={styles.heroSide}>{formatKm(rangeKm)}</Text>
            <Text style={styles.heroLabel}>{formatKm(remainingKm)} to go</Text>
          </View>
        </Row>
        <View style={{ marginTop: space.md }}>
          <BatteryBar percent={pct} height={10} marker={plan.reservePercent} />
        </View>
        <Row gap={6} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
          <View style={styles.pill}>
            <Ionicons name={fromCar ? 'car-sport' : 'calculator-outline'} size={12} color="#D1FAE5" />
            <Text style={styles.pillText}>{sourceText}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{Math.round(drive.live.whPerKm)} Wh/km {learned ? '· learned from car' : '· predicted'}</Text>
          </View>
        </Row>
      </View>

      {drive.finished ? (
        <Card style={{ backgroundColor: colors.primarySoft }}>
          <Row>
            <Ionicons name="flag" size={24} color={colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={text.h3}>You've arrived</Text>
              <Text style={text.body}>
                {formatKm(drive.tripKm)} driven, arrived with {Math.round(pct)}%.{learned ? ` Your car's real consumption (${Math.round(learned)} Wh/km) is saved and improves future plans.` : ''}
              </Text>
            </View>
          </Row>
        </Card>
      ) : next ? (
        <Card onPress={() => router.push(`/station/${next.station.id}`)} style={{ borderLeftWidth: 4, borderLeftColor: colors.amber }}>
          <Text style={text.small}>Next charging stop</Text>
          <Text style={text.h3}>{next.station.name}</Text>
          <Text style={text.body}>
            In {formatKm(kmToNext ?? 0)} · arrive with ~{Math.round(next.arrivalPercent)}% · charge to {Math.round(next.departurePercent)}% ({formatDuration(next.chargeMinutes)})
          </Text>
          <Row gap={6} style={{ marginTop: 6 }}>
            {next.waitMinutes > 0 ? <Badge label="Busy now" tone="red" /> : <Badge label={`${next.availablePlugs} free now`} tone="green" />}
            <Badge label={`${next.connector.powerKw} kW`} tone="blue" />
          </Row>
        </Card>
      ) : (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: plan.status === 'unreachable' ? colors.red : colors.primary }}>
          <Text style={text.h3}>{plan.status === 'unreachable' ? 'Charge soon' : 'No more charging needed'}</Text>
          <Text style={text.body}>
            {plan.status === 'unreachable'
              ? `The battery reaches ${plan.reservePercent}% in about ${formatKm(plan.strandedAtKm ?? 0)}.`
              : `Arrive at ${drive.destination.name} with about ${Math.round(plan.arrivalPercent)}% · ${formatDuration(etaMin)} left.`}
          </Text>
        </Card>
      )}

      <EVMap pins={pins} path={drive.route} fit={drive.position ? [drive.position, drive.destination.location] : undefined} height={240} />

      <Card>
        <Text style={text.h3}>Driving conditions {autoConditions ? '(automatic)' : '(manual)'}</Text>
        <Row gap={6} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
          <Badge label={`${conditions.temperatureC}°C`} tone="gray" icon="thermometer-outline" />
          <Badge label={`AC ${drive.climateOn ? 'on' : 'off'}${drive.lastSignalAt && link !== 'manual' ? ' · from car' : ''}`} tone="gray" icon="snow-outline" />
          <Badge label={conditions.profile} tone="gray" icon="speedometer-outline" />
          <Badge label={`Style: ${conditions.style}`} tone="gray" />
        </Row>
      </Card>

      {drive.events.length ? (
        <Card>
          <Text style={text.h3}>Live updates</Text>
          {drive.events.slice(0, 6).map((e, i) => (
            <Row key={e.at + e.text + i} style={{ marginTop: 8, alignItems: 'flex-start' }}>
              <Text style={[text.small, { width: 44 }]}>{new Date(e.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
              <Text style={[text.body, { flex: 1 }]}>{e.text}</Text>
            </Row>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        {!drive.finished ? (
          <Button
            title={next ? 'Navigate to next charger' : 'Navigate to destination'}
            icon="navigate"
            onPress={() => openNavigation(next ? next.station.location : drive.destination!.location, drive.position)}
          />
        ) : null}
        <Row gap={space.sm}>
          <Button style={{ flex: 1 }} title="Car screen preview" icon="tv-outline" kind="secondary" onPress={() => router.push('/car-display')} />
          <Button style={{ flex: 1 }} title="Correct %" icon="create-outline" kind="ghost" onPress={() => { setCorrected(Math.round(pct)); setCorrecting((v) => !v); }} />
        </Row>
      </View>

      {correcting ? (
        <Card>
          <Text style={text.strong}>What does your dashboard show?</Text>
          <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
            <Stepper value={corrected} min={0} max={100} onChange={setCorrected} suffix="%" />
            <Button title="Update" style={{ paddingVertical: 9 }} onPress={() => { drive.correct(corrected); setCorrecting(false); }} />
          </Row>
        </Card>
      ) : null}

      {!drive.finished ? (
        <Card style={{ backgroundColor: colors.purpleSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>Demo: simulate the drive</Text>
              <Text style={text.small}>{link === 'demo' ? 'The demo car reports its battery every 2 minutes of driving.' : 'Connect the demo car (My EV → Car connection) to see real readings.'}</Text>
            </View>
            <Pressable onPress={() => drive.setSimulating(!drive.simulating)} style={styles.play} accessibilityLabel={drive.simulating ? 'Pause simulation' : 'Start simulation'}>
              <Ionicons name={drive.simulating ? 'pause' : 'play'} size={22} color="#fff" />
            </Pressable>
          </Row>
          <Row gap={6} style={{ marginTop: space.sm }}>
            {[30, 120, 300].map((x) => (
              <Chip key={x} label={`${x}× speed`} selected={drive.speedup === x} onPress={() => drive.setSpeedup(x)} />
            ))}
          </Row>
        </Card>
      ) : null}

      <Button
        title={drive.finished ? 'Close trip' : 'End trip'}
        kind={drive.finished ? 'primary' : 'danger'}
        icon="stop-circle-outline"
        onPress={() => {
          drive.stop();
          router.back();
        }}
      />
      <Text style={[text.small, { textAlign: 'center' }]}>
        Turn-by-turn directions run in Google Maps, Waze or Apple Maps. EVWorld keeps your battery and charging plan updated in the background.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#0B1F2A', borderRadius: radius.lg, padding: space.lg },
  heroLabel: { color: '#9CB3C1', fontSize: 12 },
  heroValue: { fontSize: 48, fontWeight: '800', lineHeight: 54 },
  heroSide: { color: '#fff', fontSize: 26, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: '#D1FAE5', fontSize: 11, fontWeight: '600' },
  play: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
});

