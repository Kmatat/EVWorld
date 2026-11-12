import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { VendorAvatar } from '@/components/market';
import { Banner, Button, Card, Divider, Row, Screen, Stepper, text } from '@/components/ui';
import { formatAddress, formatEgyptMobile } from '@/core/identity';
import { buildCheckout, formatEgp, PAYMENT_LABEL, PaymentMethod } from '@/core/marketplace';
import { PRODUCTS, VENDORS } from '@/data/marketplace';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { newId, PlacedOrder, useAppStore } from '@/store/useAppStore';
import { useDefaultAddress } from '@/store/useAuthStore';
import { colors, space } from '@/theme';

export default function CartScreen() {
  const cart = useAppStore((s) => s.cart);
  const setQuantity = useAppStore((s) => s.setQuantity);
  const clearCart = useAppStore((s) => s.clearCart);
  const addOrders = useAppStore((s) => s.addOrders);
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [placed, setPlaced] = useState<PlacedOrder[] | null>(null);
  const { user, ready, requireAccount } = useRequireAccount();
  const address = useDefaultAddress();

  const summary = buildCheckout(cart, PRODUCTS, VENDORS, payment);

  if (placed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Order placed' }} />
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          <Text style={[text.h2, { marginTop: space.sm }]}>Thank you!</Text>
          <Text style={[text.body, { textAlign: 'center', marginTop: 6 }]}>
            Your basket was split into {placed.length} order{placed.length > 1 ? 's' : ''}, one per seller. Each seller ships separately and you can track every order in My EV.
          </Text>
        </Card>
        {placed.map((o) => {
          const vendor = VENDORS.find((v) => v.id === o.vendorId)!;
          return (
            <Card key={o.id}>
              <Row>
                <VendorAvatar vendor={vendor} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={text.strong}>Order #{o.id}</Text>
                  <Text style={text.small}>
                    {vendor.name} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s)
                  </Text>
                </View>
                <Text style={text.strong}>{formatEgp(o.total)}</Text>
              </Row>
            </Card>
          );
        })}
        <Button title="Continue shopping" onPress={() => router.replace('/market')} />
      </Screen>
    );
  }

  if (summary.orders.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Your cart' }} />
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Ionicons name="cart-outline" size={56} color={colors.faint} />
          <Text style={[text.h3, { marginTop: space.sm }]}>Your cart is empty</Text>
          <Text style={[text.small, { marginTop: 4 }]}>Chargers, adapters and accessories from verified sellers.</Text>
        </Card>
        <Button title="Browse accessories" onPress={() => router.push('/marketplace/products')} />
      </Screen>
    );
  }

  const placeOrder = () => {
    if (!requireAccount('/marketplace/cart')) return;
    if (!address) {
      router.push('/account/address');
      return;
    }
    const orders: PlacedOrder[] = summary.orders.map((o) => ({
      id: newId('EVW'),
      vendorId: o.vendor.id,
      items: o.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      total: o.total + (payment === 'cod' ? summary.paymentFee / summary.orders.length : 0),
      payment,
      createdAt: Date.now(),
      status: 'placed',
      deliverTo: formatAddress(address),
      contactPhone: user?.phone,
    }));
    addOrders(orders);
    clearCart();
    setPlaced(orders);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Your cart' }} />
      {summary.orders.length > 1 ? (
        <Banner text={`Items from ${summary.orders.length} sellers. They're shipped separately, so delivery is charged per seller.`} />
      ) : null}

      {summary.orders.map((o) => (
        <Card key={o.vendor.id}>
          <Row>
            <VendorAvatar vendor={o.vendor} size={32} />
            <Text style={[text.strong, { flex: 1 }]}>{o.vendor.name}</Text>
            {o.vendor.verified ? <Ionicons name="shield-checkmark" size={16} color={colors.primary} /> : null}
          </Row>
          {o.lines.map((l) => (
            <View key={l.product.id} style={{ marginTop: space.md }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={text.body} numberOfLines={2}>
                    {l.product.title}
                  </Text>
                  <Text style={text.small}>{formatEgp(l.product.priceEgp)} each</Text>
                </View>
                <Text style={text.strong}>{formatEgp(l.lineTotal)}</Text>
              </Row>
              <Row style={{ marginTop: 6, justifyContent: 'space-between' }}>
                <Stepper value={l.quantity} min={0} max={l.product.stock} onChange={(v) => setQuantity(l.product.id, v)} />
                <Pressable onPress={() => setQuantity(l.product.id, 0)} hitSlop={8}>
                  <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>Remove</Text>
                </Pressable>
              </Row>
            </View>
          ))}
          <Divider />
          <Line label="Delivery" value={o.delivery === 0 ? 'Free' : formatEgp(o.delivery)} />
          <Line label="Seller subtotal" value={formatEgp(o.total)} bold />
        </Card>
      ))}

      <Card>
        <Text style={text.h3}>Delivery</Text>
        {!ready ? (
          <>
            <Text style={[text.body, { marginTop: 4 }]}>Sign in and verify your mobile number to check out. Browsing and the cart work without an account.</Text>
            <Button title={user ? 'Verify my mobile number' : 'Sign in to check out'} icon="person-circle-outline" style={{ marginTop: space.md }} onPress={() => requireAccount('/marketplace/cart')} />
          </>
        ) : address ? (
          <>
            <Pressable onPress={() => router.push('/account/addresses?select=1')} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: space.sm }}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={text.strong}>{address.label}</Text>
                <Text style={text.body}>{formatAddress(address)}</Text>
              </View>
              <Text style={{ color: colors.primaryDark, fontWeight: '600' }}>Change</Text>
            </Pressable>
            <Row style={{ marginTop: space.md }}>
              <Ionicons name="call-outline" size={18} color={colors.inkSoft} />
              <Text style={[text.body, { flex: 1 }]}>
                {user?.name} · {user?.phone ? formatEgyptMobile(user.phone) : ''}
              </Text>
            </Row>
            <Text style={[text.small, { marginTop: 4 }]}>Your address and mobile are shared only with the sellers who ship this order.</Text>
          </>
        ) : (
          <Button title="Add a delivery address" icon="add" style={{ marginTop: space.md }} onPress={() => router.push('/account/address')} />
        )}
      </Card>

      <Card>
        <Text style={text.h3}>Payment</Text>
        {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => (
          <Pressable key={m} onPress={() => setPayment(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <Ionicons name={payment === m ? 'radio-button-on' : 'radio-button-off'} size={20} color={payment === m ? colors.primary : colors.faint} />
            <Text style={text.body}>{PAYMENT_LABEL[m]}</Text>
          </Pressable>
        ))}
        <Text style={text.small}>Online payments are held by EVWorld and released to sellers after delivery (buyer protection).</Text>
      </Card>

      <Card>
        <Line label={`Items (${summary.itemCount})`} value={formatEgp(summary.itemsSubtotal)} />
        <Line label="Delivery" value={summary.deliveryTotal ? formatEgp(summary.deliveryTotal) : 'Free'} />
        {summary.paymentFee ? <Line label="Cash-on-delivery fee" value={formatEgp(summary.paymentFee)} /> : null}
        <Divider />
        <Line label="Total" value={formatEgp(summary.grandTotal)} bold />
      </Card>

      <Button
        title={!ready ? 'Sign in to place your order' : !address ? 'Add an address to continue' : `Place ${summary.orders.length > 1 ? `${summary.orders.length} orders` : 'order'} · ${formatEgp(summary.grandTotal)}`}
        icon="lock-closed-outline"
        onPress={placeOrder}
      />
      <Text style={[text.small, { textAlign: 'center' }]}>Demo checkout: no payment is taken.</Text>
    </Screen>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={bold ? text.strong : text.body}>{label}</Text>
      <Text style={bold ? text.strong : text.body}>{value}</Text>
    </Row>
  );
}
