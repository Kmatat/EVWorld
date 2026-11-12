import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { VendorRow } from '@/components/market';
import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Card, Chip, Divider, Row, Screen, text } from '@/components/ui';
import { formatDuration } from '@/core/geo';
import { formatEgp } from '@/core/marketplace';
import { shopById, vendorById } from '@/data/marketplace';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { colors, space } from '@/theme';
import { openNavigation } from '@/utils/locations';

const SLOTS = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];

export default function ShopDetail() {
  const { id, service: preselect } = useLocalSearchParams<{ id: string; service?: string }>();
  const shop = shopById(String(id));
  const vehicle = useVehicle();
  const addBooking = useAppStore((s) => s.addBooking);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) };
      }),
    [],
  );
  const [service, setService] = useState<string | undefined>(preselect);
  const [day, setDay] = useState(days[0].key);
  const [slot, setSlot] = useState<string>();
  const [booked, setBooked] = useState<string>();

  if (!shop) return <Screen><Banner tone="amber" text="Workshop not found." /></Screen>;
  const vendor = vendorById(shop.vendorId)!;
  const supportsCar = shop.brands.some((b) => b === 'All brands' || b.toLowerCase() === vehicle.make.toLowerCase() || (b === 'Chinese imports' && vehicle.note));

  return (
    <Screen>
      <Stack.Screen options={{ title: shop.title }} />
      <VendorRow vendor={vendor} />
      <Card>
        <Text style={text.h2}>{shop.title}</Text>
        <Text style={[text.body, { marginTop: 4 }]}>{vendor.description}</Text>
        <Row gap={6} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          <Badge label={shop.hours} icon="time-outline" tone="gray" />
          {shop.mobile ? <Badge label="Mobile service available" icon="car-outline" tone="blue" /> : null}
          {supportsCar ? <Badge label={`Services ${vehicle.make}`} icon="checkmark-circle" tone="green" /> : <Badge label={`Ask about ${vehicle.make}`} tone="amber" />}
        </Row>
        <Text style={[text.small, { marginTop: space.md }]}>Brands: {shop.brands.join(', ')}</Text>
        <Pressable onPress={() => openNavigation(shop.location)} style={{ marginTop: space.sm }}>
          <Text style={{ color: colors.primaryDark, fontWeight: '600' }}>
            <Ionicons name="location-outline" size={14} /> {shop.address} · Directions
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={text.h3}>1. Choose a service</Text>
        {shop.services.map((s, i) => (
          <View key={s.name} style={i === 0 ? { marginTop: space.md } : undefined}>
            {i > 0 ? <Divider /> : null}
            <Pressable onPress={() => setService(s.name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={service === s.name ? 'radio-button-on' : 'radio-button-off'} size={20} color={service === s.name ? colors.primary : colors.faint} />
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{s.name}</Text>
                <Text style={text.small}>About {formatDuration(s.durationMin)}</Text>
              </View>
              <Text style={text.strong}>{s.priceFromEgp > 0 ? `from ${formatEgp(s.priceFromEgp)}` : 'Free quote'}</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={text.h3}>2. Pick a day and time</Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.md }}>
          {days.map((d) => (
            <Chip key={d.key} label={d.label} selected={day === d.key} onPress={() => setDay(d.key)} />
          ))}
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.md }}>
          {SLOTS.map((t, i) => {
            const taken = (day.charCodeAt(9) + i) % 4 === 0; // demo: some slots are already booked
            return <Chip key={t} label={taken ? `${t} · full` : t} selected={slot === t} onPress={taken ? undefined : () => setSlot(t)} />;
          })}
        </Row>
      </Card>

      {booked ? (
        <Banner tone="green" icon="checkmark-circle" text={`Booked! ${booked}. The workshop will confirm on WhatsApp. You can see it in My EV → Activity.`} />
      ) : null}

      <Button
        title="Book appointment"
        icon="calendar-outline"
        disabled={!service || !slot}
        onPress={() => {
          const label = days.find((d) => d.key === day)?.label ?? day;
          addBooking({ shopId: shop.id, service: service!, date: label, time: slot! });
          setBooked(`${service} on ${label} at ${slot}`);
          toast('Appointment requested');
        }}
      />
      <Row gap={space.sm}>
        <Button style={{ flex: 1 }} title="Call" icon="call-outline" kind="ghost" onPress={() => toast('Demo: this would call the workshop')} />
        <Button style={{ flex: 1 }} title="WhatsApp" icon="logo-whatsapp" kind="ghost" onPress={() => toast('Demo: this would open a WhatsApp chat')} />
      </Row>
      <Pressable onPress={() => router.push(`/marketplace/vendor/${vendor.id}`)}>
        <Text style={[text.small, { textAlign: 'center', color: colors.primaryDark }]}>See everything {vendor.name} offers</Text>
      </Pressable>
    </Screen>
  );
}
