import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { CarCard } from '@/components/market';
import { Button, Chip, ChipRow, Screen, text } from '@/components/ui';
import { CARS } from '@/data/marketplace';

type Seller = 'all' | 'dealer' | 'owner';
type Sort = 'newest' | 'price_asc' | 'battery';

export default function CarsScreen() {
  const [seller, setSeller] = useState<Seller>('all');
  const [make, setMake] = useState<string>();
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('newest');
  const makes = [...new Set(CARS.map((c) => c.make))].sort();

  const list = CARS.filter(
    (c) => (seller === 'all' || c.sellerKind === seller) && (!make || c.make === make) && (!certifiedOnly || c.batteryHealthSource === 'certified_inspection'),
  ).sort((a, b) =>
    sort === 'price_asc'
      ? a.priceEgp - b.priceEgp
      : sort === 'battery'
        ? (b.batteryHealthPercent ?? 0) - (a.batteryHealthPercent ?? 0)
        : Number(b.featured) - Number(a.featured) || a.postedDaysAgo - b.postedDaysAgo,
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'EVs for sale' }} />
      <ChipRow>
        <Chip label="All sellers" selected={seller === 'all'} onPress={() => setSeller('all')} />
        <Chip label="Dealers & agents" selected={seller === 'dealer'} onPress={() => setSeller('dealer')} />
        <Chip label="Owners" selected={seller === 'owner'} onPress={() => setSeller('owner')} />
        <Chip label="Certified battery" icon="ribbon-outline" selected={certifiedOnly} onPress={() => setCertifiedOnly((v) => !v)} />
      </ChipRow>
      <ChipRow>
        <Chip label="Any make" selected={!make} onPress={() => setMake(undefined)} />
        {makes.map((m) => (
          <Chip key={m} label={m} selected={make === m} onPress={() => setMake(m)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="Newest" selected={sort === 'newest'} onPress={() => setSort('newest')} />
        <Chip label="Lowest price" selected={sort === 'price_asc'} onPress={() => setSort('price_asc')} />
        <Chip label="Best battery" selected={sort === 'battery'} onPress={() => setSort('battery')} />
      </ChipRow>
      <Text style={text.small}>{list.length} cars</Text>
      {list.map((c) => (
        <CarCard key={c.id} car={c} />
      ))}
      <Button title="List your car for free" icon="add" kind="secondary" onPress={() => router.push('/marketplace/sell?mode=car')} />
    </Screen>
  );
}
