import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { ShopCard } from '@/components/market';
import { Banner, Chip, ChipRow, Screen, text } from '@/components/ui';
import { roadKm } from '@/core/roads';
import { SHOPS } from '@/data/marketplace';
import { useUserLocation } from '@/hooks/useUserLocation';

const FILTERS = ['All', 'Battery', 'Air-conditioning', 'Tires', 'Wallbox installation', 'Body work'];

export default function ShopsScreen() {
  const gps = useUserLocation({ auto: false });
  const [filter, setFilter] = useState('All');
  const [mobileOnly, setMobileOnly] = useState(false);

  const list = SHOPS.filter(
    (s) =>
      (filter === 'All' || [...s.specialties, ...s.services.map((x) => x.name)].some((t) => t.toLowerCase().includes(filter.toLowerCase().split(' ')[0]))) &&
      (!mobileOnly || s.mobile),
  )
    .map((s) => ({ shop: s, km: roadKm(gps.location, s.location) }))
    .sort((a, b) => a.km - b.km);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Repair shops & parts' }} />
      <Banner text="Only workshops with technicians trained on high-voltage EV systems are listed. Book online and pay at the shop." icon="shield-checkmark-outline" tone="green" />
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="Comes to you" icon="car-outline" selected={mobileOnly} onPress={() => setMobileOnly((v) => !v)} />
      </ChipRow>
      <Text style={text.small}>
        {list.length} workshop{list.length === 1 ? '' : 's'} · sorted by distance from {gps.source === 'gps' ? 'you' : 'Cairo'}
      </Text>
      {list.map(({ shop, km }) => (
        <ShopCard key={shop.id} shop={shop} distanceKm={km} />
      ))}
    </Screen>
  );
}
