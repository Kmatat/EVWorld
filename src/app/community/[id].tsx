import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { communityFits } from '@/components/CommunityChargerCard';
import EVMap from '@/components/map/EVMap';
import { Badge, Banner, Button, Card, Chip, Divider, Field, Row, Screen, Stars, text } from '@/components/ui';
import { COMMUNITY_PLUG_LABEL, describeAvailability, isAvailableAt, PARKING_LABEL, quoteSession, SERVICE_FEE_RATE, visibleLocation } from '@/core/community';
import { formatDuration, formatKm } from '@/core/geo';
import { formatEgp } from '@/core/marketplace';
import { consumption } from '@/core/range';
import { roadKm } from '@/core/roads';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { communityChargerById, useCommunityStore } from '@/store/useCommunityStore';
import { colors, space } from '@/theme';
import { openNavigation } from '@/utils/locations';

export default function CommunityChargerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hosted = useCommunityStore((s) => s.hosted);
  const charger = useMemo(() => communityChargerById(String(id)), [id, hosted]);
  const vehicle = useVehicle();
  const conditions = useAppStore((s) => s.conditions);
  const gps = useUserLocation({ auto: false });
  const { user, requireAccount } = useRequireAccount();
  const bookings = useCommunityStore((s) => s.bookings);
  const requestBooking = useCommunityStore((s) => s.requestBooking);
  const openConversation = useCommunityStore((s) => s.openConversation);
  const slots = useMemo(() => buildSlots(), []);
  const [slot, setSlot] = useState<string>();
  const [kwh, setKwh] = useState(20);
  const [note, setNote] = useState('');
  const [requesting, setRequesting] = useState(false);

  if (!charger) return <Screen><Banner tone="amber" text="This charger is no longer listed." /></Screen>;

  const isHost = !!user && charger.hostId === user.id;
  const activeBooking = bookings.find((b) => b.chargerId === charger.id && b.myRole === 'driver' && ['accepted', 'charging'].includes(b.status));
  const pending = bookings.find((b) => b.chargerId === charger.id && b.myRole === 'driver' && b.status === 'requested');
  const { location, exact } = visibleLocation(charger, !!activeBooking, isHost);
  const fit = communityFits(charger, vehicle);
  const power = Math.min(charger.powerKw, vehicle.maxAcKw);
  const quote = quoteSession(kwh, charger.pricePerKwh);
  const kmAdded = (kwh * 0.9 * 1000) / consumption(vehicle, conditions).totalWhPerKm;
  const open = isAvailableAt(charger.availability, new Date());

  const send = () => {
    if (!requireAccount(`/community/${charger.id}`)) return;
    const conv = requestBooking(charger, { slotLabel: slot!, estKwh: kwh, note });
    router.push(`/chat/${conv}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Community charger' }} />
      <Card>
        <Row gap={6}>
          <Ionicons name="home" size={14} color={colors.purple} />
          <Text style={{ color: colors.purple, fontWeight: '700', fontSize: 12 }}>COMMUNITY CHARGER</Text>
        </Row>
        <Text style={[text.h2, { marginTop: 4 }]}>{charger.title}</Text>
        <Row gap={8} style={{ marginTop: 6 }}>
          <Text style={text.body}>Hosted by {charger.hostName}</Text>
          <Stars rating={charger.hostRating} reviews={charger.hostSessions} />
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.md }}>
          {charger.hostPhoneVerified ? <Badge label="Verified mobile" tone="green" icon="shield-checkmark-outline" /> : null}
          <Badge label={open ? 'Open now' : 'Closed now'} tone={open ? 'green' : 'gray'} />
          <Badge label={PARKING_LABEL[charger.parking]} tone="gray" icon="car-outline" />
          <Badge label={`${formatKm(roadKm(gps.location, charger.location))} away`} tone="blue" icon="navigate-outline" />
        </Row>
        <Text style={[text.body, { marginTop: space.md }]}>{charger.description}</Text>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={text.small}>Price</Text>
            <Text style={text.price}>EGP {charger.pricePerKwh} / kWh</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={text.small}>Power</Text>
            <Text style={text.price}>{charger.powerKw} kW</Text>
          </View>
        </Row>
        <Divider />
        <Text style={text.strong}>{COMMUNITY_PLUG_LABEL[charger.plug]}</Text>
        <Text style={text.small}>{describeAvailability(charger.availability)}</Text>
        <View style={{ marginTop: space.sm }}>
          {fit === 'yes' ? (
            <Badge label={`Fits your ${vehicle.make} · charges at ${power} kW`} tone="green" icon="checkmark-circle" />
          ) : fit === 'portable' ? (
            <Banner tone="amber" icon="battery-charging-outline" text="This is a wall socket. Bring your own portable charger (available in the Market)." />
          ) : (
            <Banner tone="amber" icon="warning-outline" text={`This plug doesn't fit your car's ${vehicle.acConnector === 'gbt_ac' ? 'GB/T' : 'Type 2'} socket without an adapter.`} />
          )}
        </View>
      </Card>

      <Card>
        <Text style={text.h3}>Location</Text>
        <Text style={[text.small, { marginTop: 2, marginBottom: space.sm }]}>
          {exact ? `${charger.area}, ${charger.city}` : `${charger.area}, ${charger.city}. The exact spot is shared once the host accepts your request.`}
        </Text>
        <EVMap pins={[{ id: charger.id, location, kind: 'community', color: colors.purple, title: charger.title }]} fit={[location]} height={180} />
        {activeBooking ? (
          <>
            <Banner tone="green" icon="key-outline" text={`Access: ${charger.accessInstructions}`} />
            <Button title="Navigate to charger" icon="navigate" style={{ marginTop: space.sm }} onPress={() => openNavigation(charger.location)} />
          </>
        ) : null}
      </Card>

      {isHost ? (
        <Banner tone="purple" text="This is your charger. Manage it from My EV → My shared chargers." />
      ) : activeBooking || pending ? (
        <Button title="Open chat with host" icon="chatbubbles-outline" onPress={() => router.push(`/chat/${(activeBooking ?? pending)!.conversationId}`)} />
      ) : requesting ? (
        <Card>
          <Text style={text.h3}>Request to charge</Text>
          <Text style={[text.small, { marginTop: 2 }]}>Pick a time</Text>
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
            {slots.map((s) => (
              <Chip key={s} label={s} selected={slot === s} onPress={() => setSlot(s)} />
            ))}
          </Row>
          <Text style={[text.small, { marginTop: space.md }]}>How much energy?</Text>
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
            {[10, 20, 30, 40].map((k) => (
              <Chip key={k} label={`${k} kWh`} selected={kwh === k} onPress={() => setKwh(k)} />
            ))}
          </Row>
          <Text style={[text.small, { marginTop: space.sm }]}>
            ≈ +{Math.round(kmAdded)} km for your car · about {formatDuration((kwh / (power * 0.9)) * 60)} at {power} kW
          </Text>
          <Divider />
          <Line label={`${kwh} kWh × EGP ${charger.pricePerKwh}`} value={formatEgp(quote.energyCost)} />
          <Line label={`Service fee (${Math.round(SERVICE_FEE_RATE * 100)}%)`} value={formatEgp(quote.serviceFee)} />
          <Line label="Estimated total" value={formatEgp(quote.total)} bold />
          <Text style={[text.small, { marginBottom: space.md }]}>You pay for the kWh actually charged, after the session.</Text>
          <Field label="Message to the host (optional)" value={note} onChangeText={setNote} placeholder="e.g. I drive a white BYD Atto 3" multiline />
          <Button title="Send request" icon="paper-plane-outline" disabled={!slot} onPress={send} />
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title="Request to charge" icon="flash" onPress={() => (requireAccount(`/community/${charger.id}`) ? setRequesting(true) : undefined)} />
          <Button
            title="Message host"
            icon="chatbubble-ellipses-outline"
            kind="secondary"
            onPress={() => {
              if (!requireAccount(`/community/${charger.id}`)) return;
              const conv = openConversation({ kind: 'community', subjectId: charger.id, title: charger.title, counterpartName: charger.hostName, myRole: 'driver' });
              router.push(`/chat/${conv}`);
            }}
          />
        </View>
      )}
      <Text style={[text.small, { textAlign: 'center' }]}>Phone numbers are never shared. All messages and payments stay inside EVWorld.</Text>
    </Screen>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={bold ? text.strong : text.body}>{label}</Text>
      <Text style={bold ? text.strong : text.body}>{value}</Text>
    </Row>
  );
}

function buildSlots(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let d = 0; d < 3; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);
    const day = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
    for (const h of [10, 15, 19, 21]) {
      if (d === 0 && h <= now.getHours()) continue;
      out.push(`${day}, ${String(h).padStart(2, '0')}:00`);
    }
  }
  return out.slice(0, 8);
}
