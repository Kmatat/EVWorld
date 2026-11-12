import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Badge, Banner, Button, Card, Row, Screen, text } from '@/components/ui';
import { formatAddress } from '@/core/identity';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, space } from '@/theme';

/** Address book. With ?select=1 (from checkout) tapping an address makes it the delivery address. */
export default function AddressesScreen() {
  const { select } = useLocalSearchParams<{ select?: string }>();
  const addresses = useAuthStore((s) => s.addresses);
  const setDefault = useAuthStore((s) => s.setDefaultAddress);
  const remove = useAuthStore((s) => s.removeAddress);

  return (
    <Screen>
      <Stack.Screen options={{ title: select ? 'Deliver to' : 'My addresses' }} />
      {addresses.length === 0 ? <Banner icon="location-outline" text="Add an address for marketplace deliveries. Sellers only see it when they ship your order." /> : null}
      {addresses.map((a) => (
        <Card
          key={a.id}
          onPress={() => {
            if (select) {
              setDefault(a.id);
              router.back();
            } else router.push({ pathname: '/account/address', params: { id: a.id } });
          }}
        >
          <Row style={{ alignItems: 'flex-start' }}>
            <Ionicons name={a.label === 'Home' ? 'home-outline' : a.label === 'Work' ? 'briefcase-outline' : 'location-outline'} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <Text style={text.strong}>{a.label}</Text>
                {a.isDefault ? <Badge label="Default" tone="green" /> : null}
              </Row>
              <Text style={[text.body, { marginTop: 2 }]}>{formatAddress(a)}</Text>
            </View>
            {select ? <Ionicons name={a.isDefault ? 'radio-button-on' : 'radio-button-off'} size={20} color={a.isDefault ? colors.primary : colors.faint} /> : null}
          </Row>
          {!select ? (
            <Row gap={space.lg} style={{ marginTop: space.sm, paddingLeft: 28 }}>
              {!a.isDefault ? (
                <Pressable onPress={() => setDefault(a.id)} hitSlop={6}>
                  <Text style={{ color: colors.primaryDark, fontWeight: '600', fontSize: 13 }}>Make default</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => remove(a.id)} hitSlop={6}>
                <Text style={{ color: colors.red, fontWeight: '600', fontSize: 13 }}>Delete</Text>
              </Pressable>
            </Row>
          ) : null}
        </Card>
      ))}
      <Button title="Add a new address" icon="add" kind={addresses.length ? 'secondary' : 'primary'} onPress={() => router.push('/account/address')} />
    </Screen>
  );
}
