import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useCartCount } from '@/store/useAppStore';
import { useUnreadCount } from '@/store/useCommunityStore';
import { colors } from '@/theme';

function CartButton() {
  const count = useCartCount();
  return (
    <Pressable onPress={() => router.push('/marketplace/cart')} style={{ paddingHorizontal: 16 }} accessibilityLabel="Open cart" hitSlop={8}>
      <Ionicons name="cart-outline" size={24} color={colors.ink} />
      {count > 0 ? (
        <View style={{ position: 'absolute', right: 8, top: -4, backgroundColor: colors.red, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const unread = useUnreadCount();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Charge', headerTitle: 'Find a charger', tabBarIcon: ({ color, size }) => <Ionicons name="flash" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="trip"
        options={{ title: 'Trip', headerTitle: 'Range & trip planner', tabBarIcon: ({ color, size }) => <Ionicons name="navigate" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          headerTitle: 'EV Marketplace',
          headerRight: () => <CartButton />,
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          headerTitle: 'Messages',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="car"
        options={{ title: 'My EV', headerTitle: 'My EV & activity', tabBarIcon: ({ color, size }) => <Ionicons name="car-sport" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
