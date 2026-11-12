import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/market';
import { Chip, ChipRow, Row, Screen, text } from '@/components/ui';
import { PRODUCT_CATEGORY_LABEL, ProductCategory, productFits } from '@/core/marketplace';
import { PRODUCTS } from '@/data/marketplace';
import { useVehicle } from '@/store/useAppStore';
import { space } from '@/theme';

type Sort = 'popular' | 'price_asc' | 'price_desc';

export default function ProductsScreen() {
  const params = useLocalSearchParams<{ category?: string; fits?: string }>();
  const vehicle = useVehicle();
  const [category, setCategory] = useState<ProductCategory | undefined>(params.category as ProductCategory | undefined);
  const [fitsOnly, setFitsOnly] = useState(params.fits === '1');
  const [sort, setSort] = useState<Sort>('popular');

  const list = PRODUCTS.filter((p) => (!category || p.category === category) && (!fitsOnly || productFits(p, vehicle))).sort((a, b) =>
    sort === 'price_asc' ? a.priceEgp - b.priceEgp : sort === 'price_desc' ? b.priceEgp - a.priceEgp : b.reviews * b.rating - a.reviews * a.rating,
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: 'EV accessories' }} />
      <ChipRow>
        <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
        {(Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]).map((c) => (
          <Chip key={c} label={PRODUCT_CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ChipRow>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Chip label={`Fits my ${vehicle.make}`} icon="car-outline" selected={fitsOnly} onPress={() => setFitsOnly((v) => !v)} />
        <Row gap={6}>
          <Chip label="Popular" selected={sort === 'popular'} onPress={() => setSort('popular')} />
          <Chip label="Price ↑" selected={sort === 'price_asc'} onPress={() => setSort('price_asc')} />
          <Chip label="Price ↓" selected={sort === 'price_desc'} onPress={() => setSort('price_desc')} />
        </Row>
      </Row>
      <Text style={text.small}>
        {list.length} product{list.length === 1 ? '' : 's'} from {new Set(list.map((p) => p.vendorId)).size} sellers
      </Text>
      <View style={styles.grid}>
        {list.map((p) => (
          <ProductCard key={p.id} product={p} vehicle={vehicle} width="48.5%" />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
});
