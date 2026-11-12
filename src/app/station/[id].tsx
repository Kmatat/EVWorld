import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { availabilityLabel } from '@/components/StationCard';
import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Card, Chip, Divider, IconName, Row, Screen, text } from '@/components/ui';
import { billedKwh, chargeCostEgp, chargeMinutes, compatibleConnectors, effectivePowerKw, vehicleAccepts } from '@/core/charging';
import { formatDuration, formatKm } from '@/core/geo';
import { formatEgp, productFits } from '@/core/marketplace';
import { roadKm } from '@/core/roads';
import { liveStatus, minutesAgo } from '@/core/stations';
import { Amenity, CONNECTOR_LABEL, isDcConnector } from '@/core/types';
import { PRODUCTS } from '@/data/marketplace';
import { operatorById, stationById } from '@/data/stations';
import { useNow } from '@/hooks/useNow';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { colors, space } from '@/theme';
import { openNavigation } from '@/utils/locations';

const AMENITY: Record<Amenity, { label: string; icon: IconName }> = {
  cafe: { label: 'Café', icon: 'cafe-outline' },
  restroom: { label: 'Restrooms', icon: 'water-outline' },
  mall: { label: 'Mall', icon: 'business-outline' },
  mosque: { label: 'Mosque', icon: 'moon-outline' },
  wifi: { label: 'Wi-Fi', icon: 'wifi-outline' },
  restaurant: { label: 'Restaurant', icon: 'restaurant-outline' },
  fuel: { label: 'Fuel station', icon: 'speedometer-outline' },
  hotel: { label: 'Hotel', icon: 'bed-outline' },
};

const ISSUES = ['Charger broken', 'Plug type wrong', 'Price is different', 'Location is wrong', 'Blocked by a fuel car', 'Other'];

export default function StationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const station = stationById(String(id));
  const vehicle = useVehicle();
  const now = useNow();
  const gps = useUserLocation({ auto: false });
  const battery = useAppStore((s) => s.batteryPercent);
  const watched = useAppStore((s) => s.watchedStations.includes(String(id)));
  const toggleWatch = useAppStore((s) => s.toggleWatch);
  const addReport = useAppStore((s) => s.addReport);
  const setDestination = useAppStore((s) => s.setDestination);
  const [reporting, setReporting] = useState(false);
  const [issue, setIssue] = useState<string>();

  if (!station) {
    return (
      <Screen>
        <Banner tone="amber" text="This charger could not be found." />
      </Screen>
    );
  }

  const live = liveStatus(station, now);
  const operator = operatorById(station.operatorId);
  const status = availabilityLabel(live);
  const best = compatibleConnectors(vehicle, station)[0];
  const target = best && isDcConnector(best.type) ? 80 : 100;
  const from = Math.min(battery, target);
  const minutes = best ? chargeMinutes(vehicle, best, from, target) : 0;
  const cost = chargeCostEgp(vehicle, station, from, target);
  const distance = roadKm(gps.location, station.location);

  // Cross-sell: an adapter in the marketplace that makes this station usable.
  const adapter = !best
    ? PRODUCTS.find((p) => p.unlocksConnectors?.some((c) => station.connectors.some((sc) => sc.type === c)) && productFits(p, vehicle))
    : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: station.name }} />
      <Card>
        <Text style={text.h2}>{station.name}</Text>
        <Row gap={6} style={{ marginTop: 4 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: operator?.color }} />
          <Text style={text.small}>{operator?.name}</Text>
        </Row>
        <Text style={[text.body, { marginTop: 8 }]}>
          {station.address}, {station.city}
        </Text>
        <Row gap={6} style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <Badge label={status.label} tone={status.tone} />
          <Badge label={station.open24h ? 'Open 24/7' : 'Venue opening hours'} tone="gray" icon="time-outline" />
          <Badge label={`${formatKm(distance)} away`} tone="blue" icon="navigate-outline" />
        </Row>
        <Text style={[text.small, { marginTop: 8 }]}>Live status updated {minutesAgo(live.updatedAt, now)} (simulated)</Text>
      </Card>

      <Card>
        <Text style={text.h3}>Plugs right now</Text>
        {live.connectors.map((c, i) => {
          const fits = vehicleAccepts(vehicle, c.type);
          return (
            <View key={i} style={{ marginTop: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={text.strong}>
                  {CONNECTOR_LABEL[c.type]} · {c.powerKw} kW
                </Text>
                {fits ? <Badge label="Fits your car" tone="green" /> : <Badge label="Not for your car" tone="gray" />}
              </Row>
              <Row gap={4} style={{ marginTop: 6 }}>
                {Array.from({ length: c.count }).map((_, k) => {
                  const state = k < c.available ? 'free' : k < c.available + c.occupied ? 'busy' : 'off';
                  const bg = state === 'free' ? colors.primary : state === 'busy' ? colors.red : colors.faint;
                  return <View key={k} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: bg }} />;
                })}
              </Row>
              <Text style={[text.small, { marginTop: 4 }]}>
                {c.available} free · {c.occupied} in use · {c.offline} out of order
              </Text>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={text.h3}>Charging your {vehicle.make} {vehicle.model}</Text>
        {best ? (
          <>
            <Text style={[text.body, { marginTop: 6 }]}>
              Your car charges at up to <Text style={text.strong}>{effectivePowerKw(vehicle, best)} kW</Text> here ({CONNECTOR_LABEL[best.type]}).
            </Text>
            <Row style={{ marginTop: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={text.price}>{from >= target ? '—' : formatDuration(minutes)}</Text>
                <Text style={text.small}>
                  {Math.round(from)}% → {target}%
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={text.price}>{billedKwh(vehicle, from, target).toFixed(1)} kWh</Text>
                <Text style={text.small}>Energy billed</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={text.price}>{cost != null ? formatEgp(cost) : 'n/a'}</Text>
                <Text style={text.small}>{station.pricePerKwh != null ? `@ EGP ${station.pricePerKwh}/kWh` : 'Price not published'}</Text>
              </View>
            </Row>
            {isDcConnector(best.type) ? (
              <Text style={[text.small, { marginTop: 8 }]}>We stop at 80% on fast chargers. Above 80%, charging slows down to protect the battery.</Text>
            ) : null}
          </>
        ) : (
          <>
            <Banner tone="amber" icon="warning-outline" text={`None of these plugs fit your car (${CONNECTOR_LABEL[vehicle.acConnector]}${vehicle.dcConnector ? ` / ${CONNECTOR_LABEL[vehicle.dcConnector]}` : ''}).`} />
            {adapter ? (
              <Card onPress={() => router.push(`/marketplace/product/${adapter.id}`)} style={{ marginTop: space.md, backgroundColor: colors.purpleSoft }}>
                <Row>
                  <Ionicons name="swap-horizontal-outline" size={22} color={colors.purple} />
                  <View style={{ flex: 1 }}>
                    <Text style={text.strong}>An adapter makes this charger usable</Text>
                    <Text style={text.small}>
                      {adapter.title} · {formatEgp(adapter.priceEgp)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.purple} />
                </Row>
              </Card>
            ) : null}
          </>
        )}
      </Card>

      {station.amenities.length ? (
        <Card>
          <Text style={text.h3}>While you charge</Text>
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
            {station.amenities.map((a) => (
              <Badge key={a} label={AMENITY[a].label} icon={AMENITY[a].icon} tone="gray" />
            ))}
          </Row>
        </Card>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button title="Navigate (Google Maps)" icon="navigate" onPress={() => openNavigation(station.location)} />
        <Button
          title="Plan a trip to this charger"
          icon="map-outline"
          kind="secondary"
          onPress={() => {
            setDestination(`station:${station.id}`);
            router.push('/trip');
          }}
        />
        <Button
          title={watched ? 'Alert on — tap to stop' : 'Alert me when a plug is free'}
          icon={watched ? 'notifications' : 'notifications-outline'}
          kind="ghost"
          onPress={() => {
            toggleWatch(station.id);
            toast(watched ? 'Alert removed' : 'We will notify you by push or WhatsApp when a plug frees up');
          }}
        />
        <Button title="Report a problem" icon="flag-outline" kind="ghost" onPress={() => setReporting((r) => !r)} />
      </View>

      {reporting ? (
        <Card>
          <Text style={text.h3}>What's wrong?</Text>
          <Text style={[text.small, { marginTop: 4 }]}>Driver reports keep the map accurate for everyone.</Text>
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: space.md }}>
            {ISSUES.map((i) => (
              <Chip key={i} label={i} selected={issue === i} onPress={() => setIssue(i)} />
            ))}
          </Row>
          <Divider />
          <Button
            title="Send report"
            disabled={!issue}
            onPress={() => {
              addReport({ stationId: station.id, issue: issue! });
              setReporting(false);
              setIssue(undefined);
              toast('Thanks! Our team will verify this report.');
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
