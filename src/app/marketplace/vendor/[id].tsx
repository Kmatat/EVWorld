import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CarCard, ProductCard, ShopCard, VendorAvatar } from '@/components/market';
import { Badge, Banner, Card, Row, Screen, SectionTitle, Stars, text } from '@/components/ui';
import { CARS, PRODUCTS, SHOPS, vendorById } from '@/data/marketplace';
import { useVehicle } from '@/store/useAppStore';
import { colors, space } from '@/theme';

const TYPE_LABEL = { accessories: 'Accessories store', service_center: 'Service center', dealer: 'Car dealer / agent', private_seller: 'Private sellers' };

export default function VendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vendor = vendorById(String(id));
  const vehicle = useVehicle();
  if (!vendor) return <Screen><Banner tone="amber" text="Seller not found." /></Screen>;

  const products = PRODUCTS.filter((p) => p.vendorId === vendor.id);
  const shops = SHOPS.filter((s) => s.vendorId === vendor.id);
  const cars = CARS.filter((c) => c.vendorId === vendor.id);

  return (
    <Screen>
      <Stack.Screen options={{ title: vendor.name }} />
      <Card>
        <Row>
          <VendorAvatar vendor={vendor} size={56} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Text style={text.h2}>{vendor.name}</Text>
              {vendor.verified ? <Ionicons name="shield-checkmark" size={18} color={colors.primary} /> : null}
            </Row>
            <Text style={text.small}>
              {TYPE_LABEL[vendor.type]} · {vendor.city}
            </Text>
            {vendor.reviews > 0 ? <Stars rating={vendor.rating} reviews={vendor.reviews} /> : null}
          </View>
        </Row>
        <Text style={[text.body, { marginTop: space.md }]}>{vendor.description}</Text>
        <Row gap={6} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          {vendor.verified ? <Badge label="Verified business" tone="green" icon="shield-checkmark-outline" /> : <Badge label="Verification pending" tone="gray" />}
          <Badge label={`On EVWorld since ${vendor.since}`} tone="gray" />
        </Row>
      </Card>

      {products.length ? <SectionTitle title={`Products (${products.length})`} /> : null}
      <View style={styles.grid}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} vehicle={vehicle} width="48.5%" />
        ))}
      </View>
      {shops.length ? <SectionTitle title="Services" /> : null}
      {shops.map((s) => (
        <ShopCard key={s.id} shop={s} />
      ))}
      {cars.length ? <SectionTitle title={`Cars for sale (${cars.length})`} /> : null}
      {cars.map((c) => (
        <CarCard key={c.id} car={c} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
});
