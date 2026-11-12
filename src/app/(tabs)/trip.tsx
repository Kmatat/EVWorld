import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import BatteryControl from '@/components/BatteryControl';
import EVMap from '@/components/map/EVMap';
import { MapPin } from '@/components/map/types';
import PlacePicker from '@/components/PlacePicker';
import { Badge, Banner, BatteryBar, Button, Card, Chip, Divider, IconName, Row, Screen, SectionTitle, Stat, Stepper, text } from '@/components/ui';
import { inferClimateOn, profileFromDistance, tripTemperature } from '@/core/autoConditions';
import { formatDuration, formatKm } from '@/core/geo';
import { formatEgp, productFits } from '@/core/marketplace';
import { consumption, PROFILE_FACTOR, STYLE_FACTOR, climatePowerKw, AVERAGE_SPEED_KMH, REAL_WORLD_FACTOR, energyAtPercent } from '@/core/range';
import { roadKm, routeShapeThrough } from '@/core/roads';
import { NearbyCharger, planTrip } from '@/core/tripPlanner';
import { CONNECTOR_LABEL, DrivingStyle, RouteProfile } from '@/core/types';
import { PRODUCTS } from '@/data/marketplace';
import { STATIONS } from '@/data/stations';
import { useNow } from '@/hooks/useNow';
import { useUserLocation } from '@/hooks/useUserLocation';
import { getTemperature } from '@/services/weather';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { useDriveStore } from '@/store/useDriveStore';
import { batteryColor, colors, radius, space } from '@/theme';
import { openNavigation, resolveLocation } from '@/utils/locations';

export default function TripScreen() {
  const vehicle = useVehicle();
  const now = useNow(60_000);
  const gps = useUserLocation({ auto: false });
  const battery = useAppStore((s) => s.batteryPercent);
  const reserve = useAppStore((s) => s.reservePercent);
  const setReserve = useAppStore((s) => s.setReserve);
  const conditions = useAppStore((s) => s.conditions);
  const setConditions = useAppStore((s) => s.setConditions);
  const originId = useAppStore((s) => s.originPlaceId);
  const destinationId = useAppStore((s) => s.destinationPlaceId);
  const setOrigin = useAppStore((s) => s.setOrigin);
  const setDestination = useAppStore((s) => s.setDestination);
  const [picker, setPicker] = useState<'origin' | 'destination' | null>(null);
  const [showMath, setShowMath] = useState(false);
  const autoOn = useAppStore((s) => s.autoConditions);
  const setAuto = useAppStore((s) => s.setAutoConditions);
  const factor = useAppStore((s) => s.consumptionFactor[vehicle.id]);
  const detectedStyle = useAppStore((s) => s.detectedStyle);
  const startDrive = useDriveStore((s) => s.start);
  const driveActive = useDriveStore((s) => s.active);
  const [weather, setWeather] = useState<{ celsius: number; source: 'live' | 'typical' }>();

  const origin = originId === 'gps' ? { name: gps.source === 'gps' ? 'My location' : gps.label, location: gps.location } : resolveLocation(originId);
  const destination = resolveLocation(destinationId);

  // Automatic conditions: weather at both ends, AC from the heat, road type from distance, style from past drives.
  const oLat = origin?.location.lat;
  const oLng = origin?.location.lng;
  const dLat = destination?.location.lat;
  const dLng = destination?.location.lng;
  useEffect(() => {
    if (!autoOn || oLat == null || oLng == null) return;
    let cancelled = false;
    (async () => {
      const start = await getTemperature({ lat: oLat, lng: oLng });
      const end = dLat != null && dLng != null ? await getTemperature({ lat: dLat, lng: dLng }) : undefined;
      if (cancelled) return;
      const celsius = tripTemperature(start.celsius, end?.celsius);
      setWeather({ celsius, source: start.source === 'live' && (!end || end.source === 'live') ? 'live' : 'typical' });
      const km = dLat != null && dLng != null ? roadKm({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng }) : 0;
      const next = { temperatureC: celsius, climateOn: inferClimateOn(celsius), profile: km ? profileFromDistance(km) : conditions.profile, style: detectedStyle ?? 'normal' };
      const cur = useAppStore.getState().conditions;
      if (cur.temperatureC !== next.temperatureC || cur.climateOn !== next.climateOn || cur.profile !== next.profile || cur.style !== next.style) setConditions(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn, oLat, oLng, dLat, dLng, detectedStyle]);

  const plan = useMemo(
    () =>
      origin && destination
        ? planTrip({ vehicle, batteryPercent: battery, origin: origin.location, destination: destination.location, conditions, stations: STATIONS, reservePercent: reserve, consumptionFactor: factor, now })
        : undefined,
    [vehicle, battery, origin?.location.lat, origin?.location.lng, destination?.location.lat, destination?.location.lng, conditions, reserve, factor, now],
  );

  const pins: MapPin[] = plan
    ? [
        { id: 'origin', location: origin!.location, kind: 'origin', color: colors.blue, title: origin!.name },
        ...plan.stops.map((s, i) => ({ id: s.station.id, location: s.station.location, kind: 'stop' as const, color: colors.amber, label: String(i + 1), title: s.station.name })),
        ...(plan.status !== 'unreachable' ? [{ id: 'destination', location: destination!.location, kind: 'destination' as const, color: colors.red, title: destination!.name }] : []),
      ]
    : [];

  // Marketplace cross-sell: chargers on the route the car can't use, and an adapter that fixes it.
  const adapter = plan?.incompatibleOnRoute.length
    ? PRODUCTS.find((p) => p.unlocksConnectors?.some((c) => plan.incompatibleOnRoute.some((s) => s.connectors.some((sc) => sc.type === c))) && productFits(p, vehicle))
    : undefined;

  const recalcFromHere = async () => {
    await gps.request();
    setOrigin('gps');
  };

  return (
    <Screen>
      <BatteryControl />

      <Card>
        <Pressable onPress={() => setPicker('origin')} style={styles.endpoint}>
          <View style={[styles.endpointDot, { backgroundColor: colors.blue }]} />
          <View style={{ flex: 1 }}>
            <Text style={text.small}>From</Text>
            <Text style={text.strong}>{origin?.name ?? 'Choose start'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
        <View style={styles.endpointLine} />
        <Pressable onPress={() => setPicker('destination')} style={styles.endpoint}>
          <View style={[styles.endpointDot, { backgroundColor: colors.red }]} />
          <View style={{ flex: 1 }}>
            <Text style={text.small}>To</Text>
            <Text style={[text.strong, !destination && { color: colors.primaryDark }]}>{destination?.name ?? 'Choose destination'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (destinationId && originId !== 'gps') {
              setOrigin(destinationId);
              setDestination(originId);
            }
          }}
          style={styles.swap}
          accessibilityLabel="Swap start and destination"
        >
          <Ionicons name="swap-vertical-outline" size={18} color={colors.inkSoft} />
        </Pressable>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.h3}>Driving conditions</Text>
          <Row gap={6}>
            <Chip label="Automatic" icon="sparkles-outline" selected={autoOn} onPress={() => setAuto(true)} />
            <Chip label="Manual" selected={!autoOn} onPress={() => setAuto(false)} />
          </Row>
        </Row>
        <Text style={[text.small, { marginTop: 2 }]}>These change how much energy the car uses per km.</Text>
        {autoOn ? (
          <View style={{ marginTop: space.sm }}>
            <AutoRow icon="thermometer-outline" label="Temperature" value={`${conditions.temperatureC}°C`} source={weather?.source === 'live' ? 'live weather at start & destination' : 'typical for this area and month'} />
            <AutoRow icon="snow-outline" label="Air-conditioning" value={conditions.climateOn ? 'On' : 'Off'} source="from your car when connected, otherwise from the heat" />
            <AutoRow icon="speedometer-outline" label="Road type" value={conditions.profile[0].toUpperCase() + conditions.profile.slice(1)} source="from the trip distance, then live speed" />
            <AutoRow icon="pulse-outline" label="Driving style" value={conditions.style[0].toUpperCase() + conditions.style.slice(1)} source={detectedStyle ? 'detected from your last drive' : 'normal until your first trip'} />
            <AutoRow
              icon="analytics-outline"
              label="Your car's real use"
              value={factor ? `${factor >= 1 ? '+' : ''}${Math.round((factor - 1) * 100)}% vs model` : 'Not learned yet'}
              source={factor ? 'learned from real battery readings' : 'learned automatically once your car is connected'}
            />
          </View>
        ) : null}
        {!autoOn ? (
          <>
        <Label>Road</Label>
        <Row gap={6}>
          {(['city', 'mixed', 'highway'] as RouteProfile[]).map((p) => (
            <Chip key={p} label={p[0].toUpperCase() + p.slice(1)} selected={conditions.profile === p} onPress={() => setConditions({ profile: p })} />
          ))}
        </Row>
        <Label>Outside temperature</Label>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {[15, 25, 32, 40].map((t) => (
            <Chip key={t} label={`${t}°C`} selected={conditions.temperatureC === t} onPress={() => setConditions({ temperatureC: t })} />
          ))}
          <Chip label={conditions.climateOn ? 'AC on' : 'AC off'} icon="snow-outline" selected={conditions.climateOn} onPress={() => setConditions({ climateOn: !conditions.climateOn })} />
        </Row>
        <Label>Driving style</Label>
        <Row gap={6}>
          {(['eco', 'normal', 'sporty'] as DrivingStyle[]).map((s) => (
            <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} selected={conditions.style === s} onPress={() => setConditions({ style: s })} />
          ))}
        </Row>
          </>
        ) : null}
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <View>
            <Text style={text.strong}>People in the car</Text>
          </View>
          <Stepper value={conditions.passengers} min={1} max={7} onChange={(v) => setConditions({ passengers: v })} />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={text.strong}>Safety reserve</Text>
            <Text style={text.small}>Never plan to arrive below this</Text>
          </View>
          <Stepper value={reserve} min={5} max={30} step={5} suffix="%" onChange={setReserve} />
        </Row>
      </Card>

      {!plan ? (
        <Banner text="Choose a destination to see if you can make it, where to charge, and how long it takes." icon="map-outline" />
      ) : (
        <>
          <StatusCard plan={plan} destinationName={destination!.name} battery={battery} />

          <Card>
            <Row style={{ flexWrap: 'wrap', rowGap: space.md }}>
              <View style={styles.statCell}>
                <Stat label="Distance" value={formatKm(plan.status === 'unreachable' ? plan.directKm : plan.totalKm)} />
              </View>
              <View style={styles.statCell}>
                <Stat label="Total time (incl. charging)" value={plan.status === 'unreachable' ? '—' : formatDuration(plan.totalMinutes)} />
              </View>
              <View style={styles.statCell}>
                <Stat label={`Charging (${plan.stops.length} stop${plan.stops.length === 1 ? '' : 's'})`} value={plan.stops.length ? formatDuration(plan.chargeMinutes) : 'None'} />
              </View>
              <View style={styles.statCell}>
                <Stat label="Charging cost" value={plan.stops.length ? formatEgp(plan.chargeCostEgp) : 'EGP 0'} />
              </View>
            </Row>
          </Card>

          <EVMap pins={pins} path={routeShapeThrough(plan.path)} fit={[origin!.location, destination!.location]} height={280} onPinPress={(id) => STATIONS.some((s) => s.id === id) && router.push(`/station/${id}`)} />

          <Card>
            <Text style={text.h3}>Your trip, step by step</Text>
            <TimelineItem color={colors.blue} icon="radio-button-on" title={origin!.name} subtitle={`Leave with ${battery}%`} battery={battery} first />
            {plan.stops.map((s, i) => (
              <TimelineItem
                key={s.station.id + i}
                color={colors.amber}
                label={String(i + 1)}
                title={s.station.name}
                onPress={() => router.push(`/station/${s.station.id}`)}
                subtitle={`After ${formatKm(s.legKm)} · arrive with ${Math.round(s.arrivalPercent)}%`}
                battery={s.arrivalPercent}
              >
                <View style={styles.chargeBox}>
                  <Text style={text.strong}>
                    Charge to {Math.round(s.departurePercent)}% · {formatDuration(s.chargeMinutes)}
                    {s.costEgp != null ? ` · ${formatEgp(s.costEgp)}` : ''}
                  </Text>
                  <Text style={text.small}>
                    {CONNECTOR_LABEL[s.connector.type]} {s.connector.powerKw} kW · {s.energyKwh.toFixed(1)} kWh
                    {s.detourKm > 3 ? ` · ${Math.round(s.detourKm)} km detour` : ''}
                  </Text>
                  <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                    {s.waitMinutes > 0 ? <Badge label="Busy now · +15 min wait" tone="red" /> : <Badge label={`${s.availablePlugs} plug${s.availablePlugs === 1 ? '' : 's'} free now`} tone="green" />}
                    {s.usesReserve ? <Badge label="Below reserve on arrival" tone="amber" /> : null}
                  </Row>
                </View>
              </TimelineItem>
            ))}
            {plan.status !== 'unreachable' ? (
              <TimelineItem color={colors.red} icon="flag" title={destination!.name} subtitle={`Arrive with ${Math.round(plan.arrivalPercent)}%`} battery={plan.arrivalPercent} last />
            ) : (
              <TimelineItem color={colors.faint} icon="alert-circle-outline" title={`Battery reaches ${reserve}% after ~${formatKm(plan.strandedAtKm ?? 0)}`} subtitle={`${destination!.name} is ${formatKm(plan.directKm)} away`} last />
            )}
            <Text style={[text.small, { marginTop: space.md }]}>
              Includes {formatDuration(plan.stopOverheadMinutes)} for parking, plugging in and expected queues. Each stop charges just enough to reach the next one: charging is fastest when the battery is low.
            </Text>
          </Card>

          <View style={{ gap: space.sm }}>
            <Button
              title={driveActive ? 'Back to trip in progress' : 'Start trip (live battery updates)'}
              icon="play-circle-outline"
              onPress={() => {
                if (!driveActive) startDrive({ origin: origin!, destination: destination!, batteryPercent: battery });
                router.push('/drive');
              }}
            />
            {plan.status !== 'unreachable' ? (
              <Button title="Open in Google Maps" icon="navigate" kind="secondary" onPress={() => openNavigation(destination!.location, origin!.location, plan.stops.map((s) => s.station.location))} />
            ) : null}
            <Button title="Recalculate from my current location" icon="refresh-outline" kind="secondary" onPress={recalcFromHere} />
          </View>

          {plan.warnings.map((w, i) => (
            <Banner key={i} text={w} tone={plan.status === 'unreachable' && i === 0 ? 'red' : 'amber'} icon="warning-outline" />
          ))}

          {adapter ? (
            <Card onPress={() => router.push(`/marketplace/product/${adapter.id}`)} style={{ backgroundColor: colors.purpleSoft }}>
              <Row>
                <Ionicons name="swap-horizontal-outline" size={24} color={colors.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>
                    {plan.incompatibleOnRoute.length} charger{plan.incompatibleOnRoute.length > 1 ? 's' : ''} on this route don't fit your plug
                  </Text>
                  <Text style={text.small}>
                    {adapter.title} unlocks them · {formatEgp(adapter.priceEgp)} in the Market
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.purple} />
              </Row>
            </Card>
          ) : null}

          <NearbyList title="Chargers near your start" items={plan.nearOrigin} showArrival />
          <NearbyList title={`Chargers near ${destination!.name}`} items={plan.nearDestination} showArrival={plan.status !== 'unreachable'} />

          <Card>
            <Pressable onPress={() => setShowMath((v) => !v)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={text.h3}>How we calculated this</Text>
                <Ionicons name={showMath ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkSoft} />
              </Row>
            </Pressable>
            {showMath ? <MathBreakdown /> : null}
          </Card>
        </>
      )}

      <PlacePicker
        visible={picker !== null}
        title={picker === 'origin' ? 'Start from' : 'Where to?'}
        allowGps={picker === 'origin'}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          if (picker === 'origin') {
            setOrigin(id);
            if (id === 'gps') gps.request();
          } else setDestination(id);
          setPicker(null);
        }}
      />
    </Screen>
  );
}

function StatusCard({ plan, destinationName, battery }: { plan: NonNullable<ReturnType<typeof planTrip>>; destinationName: string; battery: number }) {
  const cfg =
    plan.status === 'direct'
      ? { bg: colors.primarySoft, fg: colors.primaryDark, icon: 'checkmark-circle' as const, title: `You can reach ${destinationName} without charging`, sub: `You'll arrive with about ${Math.round(plan.arrivalPercent)}% battery.` }
      : plan.status === 'with_stops'
        ? {
            bg: colors.amberSoft,
            fg: colors.amber,
            icon: 'flash' as const,
            title: `${plan.stops.length} charging stop${plan.stops.length > 1 ? 's' : ''} needed`,
            sub: `Driving straight there takes about ${Math.round(battery - plan.directArrivalPercent)}% of your battery${
              battery - plan.directArrivalPercent > 100 ? ' (more than a full charge)' : ''
            }, plus your ${plan.reservePercent}% reserve. You have ${battery}%. With the stops below you arrive with ${Math.round(plan.arrivalPercent)}%.`,
          }
        : { bg: colors.redSoft, fg: colors.red, icon: 'alert-circle' as const, title: `Can't reach ${destinationName} yet`, sub: `The charging network has a gap on this route for your car. You can get about ${formatKm(plan.strandedAtKm ?? 0)} of ${formatKm(plan.directKm)}.` };
  return (
    <View style={[styles.status, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={28} color={cfg.fg} />
      <View style={{ flex: 1 }}>
        <Text style={[text.h3, { color: cfg.fg }]}>{cfg.title}</Text>
        <Text style={[text.body, { color: cfg.fg }]}>{cfg.sub}</Text>
      </View>
    </View>
  );
}

function TimelineItem({
  color,
  icon,
  label,
  title,
  subtitle,
  battery,
  first,
  last,
  onPress,
  children,
}: {
  color: string;
  icon?: IconName;
  label?: string;
  title: string;
  subtitle?: string;
  battery?: number;
  first?: boolean;
  last?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ alignItems: 'center', width: 26 }}>
        <View style={{ width: 2, height: 14, backgroundColor: first ? 'transparent' : colors.border }} />
        <View style={[styles.node, { backgroundColor: color }]}>
          {label ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{label}</Text> : <Ionicons name={icon ?? 'ellipse'} size={13} color="#fff" />}
        </View>
        {!last ? <View style={{ width: 2, flex: 1, backgroundColor: colors.border }} /> : null}
      </View>
      <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, paddingTop: 12, paddingBottom: last ? 0 : space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[text.strong, { flex: 1 }]}>{title}</Text>
          {battery != null ? <Text style={{ fontWeight: '800', color: batteryColor(battery) }}>{Math.round(battery)}%</Text> : null}
        </Row>
        {subtitle ? <Text style={text.small}>{subtitle}</Text> : null}
        {battery != null ? (
          <View style={{ marginTop: 6, width: '60%' }}>
            <BatteryBar percent={battery} height={6} />
          </View>
        ) : null}
        {children}
      </Pressable>
    </View>
  );
}

function NearbyList({ title, items, showArrival }: { title: string; items: NearbyCharger[]; showArrival: boolean }) {
  if (!items.length) return null;
  return (
    <>
      <SectionTitle title={title} />
      <Card style={{ paddingVertical: space.sm }}>
        {items.map((n, i) => (
          <View key={n.station.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable onPress={() => router.push(`/station/${n.station.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>{n.station.name}</Text>
                  <Text style={text.small}>
                    {formatKm(n.roadKm)} · up to {n.bestPowerKw} kW for your car · {n.availablePlugs} free
                  </Text>
                </View>
                {showArrival && !Number.isNaN(n.arrivalPercent) ? (
                  n.reachable ? (
                    <Badge label={`${Math.round(n.arrivalPercent)}% on arrival`} tone={n.arrivalPercent < 15 ? 'amber' : 'green'} />
                  ) : (
                    <Badge label="Out of range" tone="red" />
                  )
                ) : null}
              </Row>
            </Pressable>
          </View>
        ))}
      </Card>
    </>
  );
}

function MathBreakdown() {
  const vehicle = useVehicle();
  const battery = useAppStore((s) => s.batteryPercent);
  const reserve = useAppStore((s) => s.reservePercent);
  const conditions = useAppStore((s) => s.conditions);
  const factor = useAppStore((s) => s.consumptionFactor[vehicle.id]);
  const c = consumption(vehicle, conditions);
  const energy = energyAtPercent(vehicle, battery);
  const reserveKwh = energyAtPercent(vehicle, reserve);
  const lines: [string, string][] = [
    ['Energy in battery now', `${vehicle.usableKwh} kWh × ${battery}% = ${energy.toFixed(1)} kWh`],
    ['Kept as safety reserve', `${reserveKwh.toFixed(1)} kWh (${reserve}%)`],
    ['Official (WLTP) use', `${((vehicle.usableKwh * 1000) / vehicle.wltpKm).toFixed(0)} Wh/km (${vehicle.usableKwh} kWh ÷ ${vehicle.wltpKm} km)`],
    ['Real-world correction', `× ${REAL_WORLD_FACTOR} → ${c.baseWhPerKm.toFixed(0)} Wh/km`],
    [`Road: ${conditions.profile}`, `× ${PROFILE_FACTOR[conditions.profile]}`],
    [`Style: ${conditions.style}`, `× ${STYLE_FACTOR[conditions.style]}`],
    [`${conditions.passengers} people`, `× ${(1 + Math.max(0, conditions.passengers - 1) * 0.015).toFixed(3)}`],
    [
      `AC at ${conditions.temperatureC}°C`,
      `${climatePowerKw(conditions.temperatureC, conditions.climateOn)} kW ÷ ${AVERAGE_SPEED_KMH[conditions.profile]} km/h = +${c.climateWhPerKm.toFixed(0)} Wh/km`,
    ],
    ['Total energy use', `${c.totalWhPerKm.toFixed(0)} Wh/km`],
    ...(factor ? ([['Your car (learned)', `× ${factor.toFixed(2)} → ${(c.totalWhPerKm * factor).toFixed(0)} Wh/km`]] as [string, string][]) : []),
    ['Safe range', `(${energy.toFixed(1)} − ${reserveKwh.toFixed(1)}) kWh ÷ ${(c.totalWhPerKm * (factor ?? 1)).toFixed(0)} Wh/km = ${(Math.max(0, energy - reserveKwh) * 1000 / (c.totalWhPerKm * (factor ?? 1))).toFixed(0)} km`],
  ];
  return (
    <View style={{ marginTop: space.md }}>
      {lines.map(([k, v]) => (
        <Row key={k} style={{ justifyContent: 'space-between', paddingVertical: 5, alignItems: 'flex-start' }}>
          <Text style={[text.small, { flex: 1, color: colors.inkSoft }]}>{k}</Text>
          <Text style={[text.small, { flex: 1.4, textAlign: 'right', color: colors.ink, fontWeight: '600' }]}>{v}</Text>
        </Row>
      ))}
      <Text style={[text.small, { marginTop: space.sm }]}>
        Road distances follow Egypt's main highways (e.g. Sinai via the Ahmed Hamdi tunnel). Charging times follow a typical charging curve: fast up to 80%, slower after. Live charger status comes from the networks, and is simulated in this demo.
      </Text>
    </View>
  );
}

function AutoRow({ icon, label, value, source }: { icon: IconName; label: string; value: string; source: string }) {
  return (
    <Row style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.body}>{label}</Text>
          <Text style={text.strong}>{value}</Text>
        </Row>
        <Text style={text.small}>{source}</Text>
      </View>
    </Row>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={[text.small, { marginTop: space.md, marginBottom: 6, fontWeight: '600', color: colors.inkSoft }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  endpoint: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6, paddingRight: 36 },
  endpointDot: { width: 12, height: 12, borderRadius: 6 },
  endpointLine: { width: 2, height: 14, backgroundColor: colors.border, marginLeft: 5 },
  swap: { position: 'absolute', right: space.lg, top: '50%', marginTop: -6, width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  status: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, alignItems: 'flex-start' },
  node: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statCell: { width: '48%' },
  chargeBox: { marginTop: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.amberSoft },
});
