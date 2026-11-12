import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CarListing, formatEgp, Product, productFits, ServiceShop, Vendor } from '@/core/marketplace';
import { Vehicle } from '@/core/types';
import { vendorById } from '@/data/marketplace';
import { colors, radius, space } from '@/theme';

import { Badge, Card, IconName, Row, Stars, text } from './ui';

const CATEGORY_COLOR: Record<string, string> = {
  home_charging: colors.primary,
  portable_charging: colors.blue,
  cables_adapters: colors.purple,
  interior: colors.amber,
  exterior: '#0891B2',
  electronics: '#DB2777',
  tires_tools: '#4B5563',
};

export function ProductCard({ product, vehicle, width }: { product: Product; vehicle: Vehicle; width?: number | `${number}%` }) {
  const vendor = vendorById(product.vendorId);
  const color = CATEGORY_COLOR[product.category] ?? colors.primary;
  const fits = productFits(product, vehicle);
  return (
    <Card onPress={() => router.push(`/marketplace/product/${product.id}`)} style={[{ padding: space.md, width }]}>
      <View style={[styles.productIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={product.icon as IconName} size={34} color={color} />
        {product.compareAtEgp ? (
          <View style={styles.sale}>
            <Text style={styles.saleText}>-{Math.round((1 - product.priceEgp / product.compareAtEgp) * 100)}%</Text>
          </View>
        ) : null}
      </View>
      <Text style={[text.strong, { marginTop: space.sm }]} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={[text.small, { marginTop: 2 }]} numberOfLines={1}>
        {vendor?.name}
      </Text>
      <Row style={{ marginTop: 6, justifyContent: 'space-between' }}>
        <Text style={styles.price}>{formatEgp(product.priceEgp)}</Text>
      </Row>
      <Row style={{ marginTop: 4, justifyContent: 'space-between' }}>
        <Stars rating={product.rating} reviews={product.reviews} />
        {product.compatibleWith.length ? (
          fits ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} accessibilityLabel="Fits your car" />
          ) : (
            <Ionicons name="close-circle-outline" size={16} color={colors.faint} accessibilityLabel="Not for your car" />
          )
        ) : null}
      </Row>
    </Card>
  );
}

export function CarCard({ car, compact }: { car: CarListing; compact?: boolean }) {
  const vendor = vendorById(car.vendorId);
  return (
    <Card onPress={() => router.push(`/marketplace/car/${car.id}`)} style={[{ padding: 0, overflow: 'hidden' }, compact && { width: 250 }]}>
      <View style={[styles.carHero, { backgroundColor: carTint(car.color) }]}>
        <Ionicons name="car-sport" size={compact ? 54 : 72} color="rgba(17,24,39,0.75)" />
        <View style={{ position: 'absolute', left: 10, top: 10, flexDirection: 'row', gap: 6 }}>
          {car.featured ? <Badge label="Featured" tone="amber" icon="star" /> : null}
          <Badge label={car.sellerKind === 'dealer' ? 'Dealer' : 'Owner'} tone={car.sellerKind === 'dealer' ? 'blue' : 'gray'} />
        </View>
      </View>
      <View style={{ padding: space.md }}>
        <Text style={text.strong} numberOfLines={1}>
          {car.year} {car.make} {car.model}
        </Text>
        <Text style={styles.price}>{formatEgp(car.priceEgp)}</Text>
        <Text style={text.small} numberOfLines={1}>
          {car.km.toLocaleString('en-US')} km · {car.city} · {car.spec}
        </Text>
        <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          <BatteryHealthBadge car={car} />
          {!compact ? <Badge label={`${car.rangeKm} km range`} tone="gray" icon="flash-outline" /> : null}
          {!compact && vendor?.verified ? <Badge label="Verified seller" tone="green" icon="shield-checkmark-outline" /> : null}
        </Row>
      </View>
    </Card>
  );
}

export function BatteryHealthBadge({ car }: { car: CarListing }) {
  if (car.batteryHealthPercent == null) return <Badge label="Battery health unknown" tone="gray" />;
  const certified = car.batteryHealthSource === 'certified_inspection';
  return (
    <Badge
      label={`Battery ${car.batteryHealthPercent}% ${certified ? '· certified' : '· seller-reported'}`}
      tone={certified ? (car.batteryHealthPercent >= 90 ? 'green' : 'amber') : 'gray'}
      icon={certified ? 'ribbon-outline' : 'battery-half-outline'}
    />
  );
}

export function ShopCard({ shop, distanceKm }: { shop: ServiceShop; distanceKm?: number }) {
  const vendor = vendorById(shop.vendorId)!;
  return (
    <Card onPress={() => router.push(`/marketplace/shop/${shop.id}`)} style={{ padding: space.md }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <VendorAvatar vendor={vendor} />
        <View style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[text.strong, { flex: 1 }]} numberOfLines={1}>
              {shop.title}
            </Text>
            {distanceKm != null ? <Text style={text.small}>{Math.round(distanceKm)} km</Text> : null}
          </Row>
          <Stars rating={vendor.rating} reviews={vendor.reviews} />
          <Text style={[text.small, { marginTop: 4 }]} numberOfLines={2}>
            {shop.specialties.join(' · ')}
          </Text>
          <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {vendor.verified ? <Badge label="HV-certified" tone="green" icon="shield-checkmark-outline" /> : null}
            {shop.mobile ? <Badge label="Comes to you" tone="blue" icon="car-outline" /> : null}
            <Badge label={`From ${formatEgp(Math.min(...shop.services.map((s) => s.priceFromEgp).filter((p) => p > 0)))}`} tone="gray" />
          </Row>
        </View>
      </Row>
    </Card>
  );
}

export function VendorAvatar({ vendor, size = 44 }: { vendor: Vendor; size?: number }) {
  const initials = vendor.name
    .split(' ')
    .filter((w) => /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: vendor.color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function VendorRow({ vendor }: { vendor: Vendor }) {
  return (
    <Card onPress={() => router.push(`/marketplace/vendor/${vendor.id}`)} style={{ padding: space.md }}>
      <Row>
        <VendorAvatar vendor={vendor} size={40} />
        <View style={{ flex: 1 }}>
          <Row gap={6}>
            <Text style={text.strong}>{vendor.name}</Text>
            {vendor.verified ? <Ionicons name="shield-checkmark" size={14} color={colors.primary} /> : null}
          </Row>
          <Text style={text.small}>
            {vendor.type === 'private_seller' ? 'ID-verified private sellers' : `${vendor.city} · on EVWorld since ${vendor.since}`}
          </Text>
        </View>
        {vendor.reviews > 0 ? <Stars rating={vendor.rating} reviews={vendor.reviews} /> : null}
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Row>
    </Card>
  );
}

function carTint(color: string): string {
  const c = color.toLowerCase();
  if (c.includes('blue')) return '#DBEAFE';
  if (c.includes('red')) return '#FEE2E2';
  if (c.includes('orange')) return '#FFEDD5';
  if (c.includes('grey') || c.includes('gray') || c.includes('silver')) return '#E5E7EB';
  return '#F1F5F9';
}

const styles = StyleSheet.create({
  productIcon: { height: 96, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sale: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.red, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  saleText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  price: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 2 },
  carHero: { height: 120, alignItems: 'center', justifyContent: 'center' },
});
