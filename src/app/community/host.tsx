import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { toast } from '@/components/Toast';
import { Banner, Button, Card, Chip, Divider, Field, Row, Screen, Stepper, text } from '@/components/ui';
import { COMMUNITY_PLUG_LABEL, CommunityCharger, CommunityPlug, estimateHostEarnings, PARKING_LABEL, ParkingType, suggestHostPrice, SERVICE_FEE_RATE } from '@/core/community';
import { publicName } from '@/core/identity';
import { formatEgp } from '@/core/marketplace';
import { PLACES } from '@/data/places';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useUserLocation } from '@/hooks/useUserLocation';
import { newId } from '@/store/useAppStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import { colors, space } from '@/theme';

const POWERS: Record<CommunityPlug, number[]> = {
  type2_tethered: [3.7, 7.4, 11, 22],
  type2_socket: [3.7, 7.4, 11, 22],
  gbt_ac: [3.5, 7],
  household: [2.3, 3.5],
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HostChargerScreen() {
  const { user, ready, requireAccount } = useRequireAccount();
  const publish = useCommunityStore((s) => s.publishCharger);
  const gps = useUserLocation({ auto: false });
  const [title, setTitle] = useState('');
  const [plug, setPlug] = useState<CommunityPlug>('type2_tethered');
  const [power, setPower] = useState(7.4);
  const [ownCost, setOwnCost] = useState('2.20');
  const [price, setPrice] = useState('');
  const [areaId, setAreaId] = useState<string>();
  const [area, setArea] = useState('');
  const [usedGps, setUsedGps] = useState(false);
  const [approx, setApprox] = useState(true);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [from, setFrom] = useState(18);
  const [to, setTo] = useState(23);
  const [parking, setParking] = useState<ParkingType>('villa_driveway');
  const [instructions, setInstructions] = useState('');
  const [description, setDescription] = useState('');
  const [sessions, setSessions] = useState(3);

  if (!ready) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Share your charger' }} />
        <Card>
          <Text style={text.h3}>Earn from your home charger</Text>
          <Text style={[text.body, { marginTop: 6 }]}>
            Hosts need an account with a verified mobile number, so drivers know they are dealing with real people. Your number stays private.
          </Text>
          <Button title={user ? 'Verify my mobile' : 'Sign in to continue'} style={{ marginTop: space.md }} onPress={() => requireAccount('/community/host')} />
        </Card>
      </Screen>
    );
  }

  const cost = Number(ownCost) || 0;
  const suggestion = suggestHostPrice(cost || 2.2);
  const priceNum = Number(price) || suggestion.suggested;
  const earnings = estimateHostEarnings(priceNum, cost, sessions);
  const place = PLACES.find((p) => p.id === areaId);
  const location = usedGps ? gps.location : place?.location;
  const valid = title.trim().length >= 4 && !!location && (area.trim() || place) && instructions.trim().length >= 5 && days.length > 0;

  const submit = () => {
    const charger: CommunityCharger = {
      id: newId('CC'),
      hostId: user!.id,
      hostName: publicName(user!.name),
      hostRating: 5,
      hostSessions: 0,
      hostPhoneVerified: true,
      title: title.trim(),
      plug,
      powerKw: power,
      pricePerKwh: priceNum,
      area: area.trim() || place!.name,
      city: place?.region ?? 'Egypt',
      location: location!,
      showApproximate: approx,
      availability: { days, from: `${String(from).padStart(2, '0')}:00`, to: `${String(to % 24).padStart(2, '0')}:00` },
      parking,
      accessInstructions: instructions.trim(),
      description: description.trim() || `${power} kW ${COMMUNITY_PLUG_LABEL[plug].toLowerCase()}.`,
      paused: false,
      createdAt: Date.now(),
    };
    publish(charger);
    toast('Your charger is live on the map');
    router.replace('/community/mine');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Share your charger' }} />
      <Banner
        tone="purple"
        icon="people-outline"
        text="Your listing is public: plug, power, price, hours and area. Your name shows as first name + initial, and your phone number is never shown. Drivers contact you through in-app chat."
      />

      <Card>
        <Text style={text.h3}>1. Your charger</Text>
        <View style={{ height: space.md }} />
        <Field label="Listing title" value={title} onChangeText={setTitle} placeholder="e.g. Villa wallbox near Arkan" />
        <Text style={label}>Plug</Text>
        <View style={{ gap: 6 }}>
          {(Object.keys(COMMUNITY_PLUG_LABEL) as CommunityPlug[]).map((p) => (
            <Pressable key={p} onPress={() => { setPlug(p); setPower(POWERS[p][Math.min(1, POWERS[p].length - 1)]); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <Ionicons name={plug === p ? 'radio-button-on' : 'radio-button-off'} size={20} color={plug === p ? colors.primary : colors.faint} />
              <Text style={text.body}>{COMMUNITY_PLUG_LABEL[p]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[label, { marginTop: space.md }]}>Charging power</Text>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {POWERS[plug].map((kw) => (
            <Chip key={kw} label={`${kw} kW`} selected={power === kw} onPress={() => setPower(kw)} />
          ))}
        </Row>
        <Text style={[text.small, { marginTop: 6 }]}>Check the label on your wallbox. 7.4 kW = single-phase 32 A; 11/22 kW need three-phase power.</Text>
        <Text style={[label, { marginTop: space.md }]}>Parking</Text>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(PARKING_LABEL) as ParkingType[]).map((p) => (
            <Chip key={p} label={PARKING_LABEL[p]} selected={parking === p} onPress={() => setParking(p)} />
          ))}
        </Row>
        <View style={{ height: space.md }} />
        <Field label="Description (public)" value={description} onChangeText={setDescription} placeholder="Covered parking, cable length, nearby cafés…" multiline />
      </Card>

      <Card>
        <Text style={text.h3}>2. Price per kWh</Text>
        <View style={{ height: space.md }} />
        <Field label="What you pay per kWh (from your electricity bill)" value={ownCost} onChangeText={(t) => setOwnCost(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        <Text style={[text.small, { marginTop: -6, marginBottom: space.md }]}>Charging an EV pushes most homes into the top residential tiers, so use the price from your latest bill.</Text>
        <Field label={`Your price per kWh (suggested EGP ${suggestion.low}–${suggestion.high})`} value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={String(suggestion.suggested)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.body}>Driving sessions per week (estimate)</Text>
          <Stepper value={sessions} min={1} max={14} onChange={setSessions} />
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.body}>Energy shared / month</Text>
          <Text style={text.strong}>{earnings.kWhPerMonth} kWh</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={text.body}>You receive</Text>
          <Text style={text.strong}>{formatEgp(earnings.revenue)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={text.strong}>Profit after your electricity</Text>
          <Text style={[text.price, { color: earnings.profit > 0 ? colors.primaryDark : colors.red }]}>{formatEgp(earnings.profit)}</Text>
        </Row>
        <Text style={[text.small, { marginTop: 6 }]}>Drivers pay your price plus a {Math.round(SERVICE_FEE_RATE * 100)}% EVWorld service fee. You receive your full price per kWh.</Text>
      </Card>

      <Card>
        <Text style={text.h3}>3. Location & privacy</Text>
        <Text style={[text.small, { marginTop: 2, marginBottom: space.sm }]}>Choose the nearest area, or use your current GPS position if you are at the charger now.</Text>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {PLACES.slice(0, 12).map((p) => (
            <Chip key={p.id} label={p.name.split(' (')[0]} selected={!usedGps && areaId === p.id} onPress={() => { setAreaId(p.id); setUsedGps(false); }} />
          ))}
        </Row>
        <Button
          title={usedGps ? `Using GPS position ✓` : 'Use my current location'}
          icon="locate-outline"
          kind="ghost"
          style={{ marginTop: space.sm }}
          onPress={async () => {
            const r = await gps.request();
            if (r.source === 'gps') setUsedGps(true);
            else toast('GPS is not available here. Pick the nearest area instead.');
          }}
        />
        <View style={{ height: space.md }} />
        <Field label="Area / compound (public)" value={area} onChangeText={setArea} placeholder="e.g. Sheikh Zayed, District 16" />
        <Pressable onPress={() => setApprox((v) => !v)} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Ionicons name={approx ? 'checkbox' : 'square-outline'} size={22} color={approx ? colors.primary : colors.faint} />
          <View style={{ flex: 1 }}>
            <Text style={text.strong}>Show an approximate pin until I accept a request</Text>
            <Text style={text.small}>Recommended for homes. The map shows a point a few hundred metres away, and accepted drivers get the exact spot.</Text>
          </View>
        </Pressable>
        <View style={{ height: space.md }} />
        <Field label="Access instructions (private, shared after you accept)" value={instructions} onChangeText={setInstructions} placeholder="e.g. Black gate, ring flat 3, cable on the left wall" multiline />
      </Card>

      <Card>
        <Text style={text.h3}>4. When drivers can come</Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.md }}>
          {DAYS.map((d, i) => (
            <Chip key={d} label={d} selected={days.includes(i)} onPress={() => setDays((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))} />
          ))}
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <Text style={text.body}>From</Text>
          <Stepper value={from} min={0} max={23} onChange={setFrom} suffix=":00" />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
          <Text style={text.body}>Until</Text>
          <Stepper value={to} min={1} max={30} onChange={setTo} suffix=":00" />
        </Row>
        <Text style={[text.small, { marginTop: 6 }]}>{to > 24 ? `Overnight: until ${to - 24}:00 the next morning.` : 'Set "until" above 24 for overnight availability.'}</Text>
      </Card>

      <Banner tone="amber" icon="information-circle-outline" text="Before you share: make sure your wiring and breaker are rated for EV charging, and check your building or compound rules." />
      <Button title="Publish my charger" icon="cloud-upload-outline" disabled={!valid} onPress={submit} />
      {!valid ? <Text style={[text.small, { textAlign: 'center' }]}>Add a title, a location and access instructions to publish.</Text> : null}
    </Screen>
  );
}

const label = { fontSize: 13, fontWeight: '600' as const, color: colors.inkSoft, marginBottom: 6 };
