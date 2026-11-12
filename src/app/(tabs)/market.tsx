import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CarCard, ProductCard, ShopCard } from '@/components/market';
import { Card, IconName, Row, Screen, SearchBox, SectionTitle, text } from '@/components/ui';
import { productFits } from '@/core/marketplace';
import { CARS, PRODUCTS, SHOPS } from '@/data/marketplace';
import { useVehicle } from '@/store/useAppStore';
import { colors, radius, space } from '@/theme';

export default function MarketScreen() {
  const vehicle = useVehicle();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  // Model-specific items first (e.g. floor mats for this exact car), then plug-specific, then universal.
  const relevance = (p: (typeof PRODUCTS)[number]) => (p.compatibleWith.includes(vehicle.id) ? 0 : p.compatibleWith.length ? 1 : 2);
  const forYou = PRODUCTS.filter((p) => productFits(p, vehicle)).sort((a, b) => relevance(a) - relevance(b) || b.rating * b.reviews - a.rating * a.reviews);

  if (query) {
    const products = PRODUCTS.filter((p) => `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(query));
    const shops = SHOPS.filter((s) => `${s.title} ${s.specialties.join(' ')} ${s.brands.join(' ')}`.toLowerCase().includes(query));
    const cars = CARS.filter((c) => `${c.make} ${c.model} ${c.city} ${c.year}`.toLowerCase().includes(query));
    return (
      <Screen>
        <SearchBox value={q} onChangeText={setQ} placeholder="Search accessories, shops or cars" autoFocus />
        <Text style={text.small}>
          {products.length + shops.length + cars.length} results for "{q}"
        </Text>
        {products.length ? <SectionTitle title="Accessories" /> : null}
        <View style={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} vehicle={vehicle} width="48.5%" />
          ))}
        </View>
        {shops.length ? <SectionTitle title="Service & repair" /> : null}
        {shops.map((s) => (
          <ShopCard key={s.id} shop={s} />
        ))}
        {cars.length ? <SectionTitle title="EVs for sale" /> : null}
        {cars.map((c) => (
          <CarCard key={c.id} car={c} />
        ))}
      </Screen>
    );
  }

  return (
    <Screen>
      <SearchBox value={q} onChangeText={setQ} placeholder="Search accessories, shops or cars" />

      <View style={{ gap: space.sm }}>
        <CategoryTile icon="battery-charging-outline" color={colors.primary} title="EV accessories" subtitle={`${PRODUCTS.length} products · chargers, cables, adapters`} onPress={() => router.push('/marketplace/products')} />
        <CategoryTile icon="construct-outline" color={colors.blue} title="Repair shops & parts" subtitle={`${SHOPS.length} certified EV workshops · book online`} onPress={() => router.push('/marketplace/shops')} />
        <CategoryTile icon="car-sport-outline" color={colors.amber} title="EVs for sale" subtitle={`${CARS.length} cars from dealers & owners`} onPress={() => router.push('/marketplace/cars')} />
      </View>

      <SectionTitle title={`Picked for your ${vehicle.make} ${vehicle.model.split(' (')[0]}`} action="See all" onAction={() => router.push('/marketplace/products?fits=1')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingBottom: 6 }}>
        {forYou.slice(0, 8).map((p) => (
          <ProductCard key={p.id} product={p} vehicle={vehicle} width={170} />
        ))}
      </ScrollView>

      <SectionTitle title="Featured EVs" action="All cars" onAction={() => router.push('/marketplace/cars')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingBottom: 6 }}>
        {CARS.filter((c) => c.featured).map((c) => (
          <CarCard key={c.id} car={c} compact />
        ))}
      </ScrollView>

      <SectionTitle title="Top-rated workshops" action="All shops" onAction={() => router.push('/marketplace/shops')} />
      {SHOPS.slice(0, 2).map((s) => (
        <ShopCard key={s.id} shop={s} />
      ))}

      <Card onPress={() => router.push('/marketplace/sell')} style={{ backgroundColor: colors.ink }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={[text.h3, { color: '#fff' }]}>Sell on EVWorld</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              Stores, workshops, dealers and car owners: reach EV drivers across Egypt right when they need you.
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={36} color={colors.primary} />
        </Row>
      </Card>
    </Screen>
  );
}

function CategoryTile({ icon, color, title, subtitle, onPress }: { icon: IconName; color: string; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ padding: space.md }}>
      <Row gap={space.md}>
        <View style={[styles.tileIcon, { backgroundColor: color + '1A' }]}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.h3}>{title}</Text>
          <Text style={text.small}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.faint} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  tileIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
