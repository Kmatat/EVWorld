import { router, Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Badge, Banner, Button, Card, Row, Screen, SectionTitle, text } from '@/components/ui';
import { COMMUNITY_PLUG_LABEL, describeAvailability } from '@/core/community';
import { formatEgp } from '@/core/marketplace';
import { useAuthStore } from '@/store/useAuthStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import { colors, space } from '@/theme';

const STATUS_TONE = { requested: 'amber', accepted: 'blue', charging: 'blue', completed: 'green', declined: 'gray', cancelled: 'gray' } as const;

export default function MyChargersScreen() {
  const user = useAuthStore((s) => s.user);
  const allHosted = useCommunityStore((s) => s.hosted);
  const hosted = allHosted.filter((c) => c.hostId === user?.id);
  const bookings = useCommunityStore((s) => s.bookings);
  const togglePause = useCommunityStore((s) => s.togglePause);
  const asHost = bookings.filter((b) => b.myRole === 'host');
  const asDriver = bookings.filter((b) => b.myRole === 'driver');
  const earned = asHost.reduce((s, b) => s + (b.quote?.hostEarnings ?? 0), 0);
  const kwh = asHost.reduce((s, b) => s + (b.kWh ?? 0), 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Community charging' }} />
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={text.small}>Earned as a host</Text>
            <Text style={text.price}>{formatEgp(earned)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.small}>Energy shared</Text>
            <Text style={text.price}>{kwh.toFixed(1)} kWh</Text>
          </View>
        </Row>
      </Card>

      <SectionTitle title="My shared chargers" action="Add" onAction={() => router.push('/community/host')} />
      {hosted.length === 0 ? (
        <Card>
          <Text style={text.body}>You haven't shared a charger yet. Hosts in compounds and on the North Coast earn when public chargers are busy.</Text>
          <Button title="Share my charger" icon="add" style={{ marginTop: space.md }} onPress={() => router.push('/community/host')} />
        </Card>
      ) : null}
      {hosted.map((c) => (
        <Card key={c.id} onPress={() => router.push(`/community/${c.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[text.strong, { flex: 1 }]}>{c.title}</Text>
            <Badge label={c.paused ? 'Paused' : 'Live'} tone={c.paused ? 'gray' : 'green'} />
          </Row>
          <Text style={text.small}>
            {COMMUNITY_PLUG_LABEL[c.plug]} · {c.powerKw} kW · EGP {c.pricePerKwh}/kWh
          </Text>
          <Text style={text.small}>{describeAvailability(c.availability)}</Text>
          <Pressable onPress={() => togglePause(c.id)} style={{ marginTop: space.sm }} hitSlop={6}>
            <Text style={{ color: colors.primaryDark, fontWeight: '600' }}>{c.paused ? 'Resume listing' : 'Pause listing'}</Text>
          </Pressable>
        </Card>
      ))}

      <SectionTitle title="Requests & sessions" />
      {bookings.length === 0 ? <Banner text="Your charging requests (as a driver or a host) appear here and in the Inbox." /> : null}
      {[...asHost, ...asDriver].map((b) => (
        <Card key={b.id} onPress={() => router.push(`/chat/${b.conversationId}`)} style={{ paddingVertical: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>{b.myRole === 'host' ? `${b.counterpartName} wants to charge` : `Charging at ${b.counterpartName}'s`}</Text>
              <Text style={text.small}>
                {b.slotLabel} · {b.kWh ?? b.estKwh} kWh{b.quote ? ` · ${formatEgp(b.myRole === 'host' ? b.quote.hostEarnings : b.quote.total)}` : ''}
              </Text>
            </View>
            <Badge label={b.status} tone={STATUS_TONE[b.status]} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
