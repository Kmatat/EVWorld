import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { VendorRow } from '@/components/market';
import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Card, IconName, Row, Screen, Stars, Stepper, text } from '@/components/ui';
import { formatEgp, PRODUCT_CATEGORY_LABEL, productFits } from '@/core/marketplace';
import { productById, vendorById } from '@/data/marketplace';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { colors, radius, space } from '@/theme';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = productById(String(id));
  const vehicle = useVehicle();
  const addToCart = useAppStore((s) => s.addToCart);
  const [qty, setQty] = useState(1);

  if (!product) return <Screen><Banner tone="amber" text="Product not found." /></Screen>;
  const vendor = vendorById(product.vendorId)!;
  const fits = productFits(product, vehicle);
  const freeDelivery = vendor.freeDeliveryOverEgp != null && product.priceEgp * qty >= vendor.freeDeliveryOverEgp;

  return (
    <Screen>
      <Stack.Screen options={{ title: PRODUCT_CATEGORY_LABEL[product.category] }} />
      <View style={{ height: 180, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={product.icon as IconName} size={84} color={colors.primaryDark} />
      </View>
      <Card>
        <Text style={text.h2}>{product.title}</Text>
        <Row style={{ marginTop: 6 }}>
          <Stars rating={product.rating} reviews={product.reviews} />
          <Text style={text.small}>· {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</Text>
        </Row>
        <Row style={{ marginTop: space.md, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink }}>{formatEgp(product.priceEgp)}</Text>
          {product.compareAtEgp ? <Text style={{ color: colors.faint, textDecorationLine: 'line-through', marginBottom: 4 }}>{formatEgp(product.compareAtEgp)}</Text> : null}
        </Row>
        <View style={{ marginTop: space.md }}>
          {product.compatibleWith.length === 0 ? (
            <Badge label="Works with every EV" tone="green" icon="checkmark-circle" />
          ) : fits ? (
            <Badge label={`Fits your ${vehicle.make} ${vehicle.model}`} tone="green" icon="checkmark-circle" />
          ) : (
            <Badge label={`Not compatible with your ${vehicle.make} ${vehicle.model}`} tone="amber" icon="warning-outline" />
          )}
        </View>
        <Text style={[text.body, { marginTop: space.md }]}>{product.description}</Text>
        {product.unlocksConnectors ? (
          <Banner tone="purple" icon="flash-outline" text="Unlocks more public chargers. The trip planner tells you how many chargers on your route this adapter would add." />
        ) : null}
      </Card>

      <VendorRow vendor={vendor} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.strong}>Quantity</Text>
          <Stepper value={qty} min={1} max={Math.max(1, product.stock)} onChange={setQty} />
        </Row>
        <Text style={[text.small, { marginTop: space.md }]}>
          Delivered by {vendor.name} ·{' '}
          {vendor.deliveryFeeEgp === 0 || freeDelivery ? 'Free delivery' : `Delivery ${formatEgp(vendor.deliveryFeeEgp)}`}
          {vendor.freeDeliveryOverEgp && !freeDelivery ? ` (free over ${formatEgp(vendor.freeDeliveryOverEgp)})` : ''}
        </Text>
        <Text style={text.small}>Pay by card, mobile wallet, Fawry or cash on delivery · 14-day returns</Text>
      </Card>

      <View style={{ gap: space.sm }}>
        <Button
          title={`Add to cart · ${formatEgp(product.priceEgp * qty)}`}
          icon="cart-outline"
          disabled={product.stock === 0}
          onPress={() => {
            addToCart(product.id, qty);
            toast(`Added ${qty} × ${product.title} to your cart`);
          }}
        />
        <Button
          title="Buy now"
          kind="secondary"
          disabled={product.stock === 0}
          onPress={() => {
            addToCart(product.id, qty);
            router.push('/marketplace/cart');
          }}
        />
      </View>
    </Screen>
  );
}
