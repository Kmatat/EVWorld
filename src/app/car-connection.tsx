import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Platform, Text, View } from 'react-native';

import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Card, Divider, Row, Screen, SectionTitle, text } from '@/components/ui';
import { VEHICLE_LINKS } from '@/services/vehicleData';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { colors, space } from '@/theme';

export default function CarConnectionScreen() {
  const vehicle = useVehicle();
  const link = useAppStore((s) => s.vehicleLink);
  const setLink = useAppStore((s) => s.setVehicleLink);
  const factor = useAppStore((s) => s.consumptionFactor[vehicle.id]);
  const style = useAppStore((s) => s.detectedStyle);
  const setFactor = useAppStore((s) => s.setConsumptionFactor);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Car connection' }} />
      <Card>
        <Text style={text.small}>Battery source for your {vehicle.make} {vehicle.model}</Text>
        <Text style={text.h2}>{VEHICLE_LINKS.find((l) => l.id === link)?.title}</Text>
        {factor ? (
          <Text style={[text.body, { marginTop: 6 }]}>
            Learned from your drives: your car uses {Math.abs(Math.round((factor - 1) * 100))}% {factor >= 1 ? 'more' : 'less'} energy than the standard model. All range and trip plans include this.
          </Text>
        ) : (
          <Text style={[text.body, { marginTop: 6 }]}>Once real battery readings arrive during a trip, EVWorld learns your car's actual consumption.</Text>
        )}
        {style ? <Text style={[text.small, { marginTop: 4 }]}>Detected driving style: {style}</Text> : null}
        {factor ? (
          <Button title="Reset learned consumption" kind="ghost" style={{ marginTop: space.sm, paddingVertical: 8 }} onPress={() => setFactor(vehicle.id, undefined)} />
        ) : null}
      </Card>

      <SectionTitle title="Ways to connect" />
      {VEHICLE_LINKS.map((l) => (
        <Card key={l.id} style={link === l.id ? { borderWidth: 2, borderColor: colors.primary } : undefined}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={l.icon} size={20} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[text.strong, { flex: 1 }]}>{l.title}</Text>
                {link === l.id ? <Badge label="Active" tone="green" /> : <Badge label={l.availableNow ? 'Available' : 'Coming'} tone={l.availableNow ? 'blue' : 'gray'} />}
              </Row>
              <Text style={[text.body, { marginTop: 4 }]}>{l.body}</Text>
              <Text style={[text.small, { marginTop: 6 }]}>Gives: {l.gives}</Text>
              <Text style={text.small}>Status: {l.status}</Text>
              {l.availableNow && link !== l.id ? (
                <Button
                  title={l.id === 'demo' ? 'Connect demo car' : 'Use this'}
                  kind="secondary"
                  style={{ marginTop: space.sm, alignSelf: 'flex-start', paddingVertical: 9 }}
                  onPress={() => {
                    setLink(l.id);
                    toast(l.id === 'demo' ? 'Demo car connected. Start a trip to see live battery updates.' : `${l.title} selected`);
                  }}
                />
              ) : null}
            </View>
          </Row>
        </Card>
      ))}

      <Card>
        <Row>
          <Ionicons name="logo-apple" size={22} color={colors.ink} />
          <Text style={[text.h3, { flex: 1 }]}>Apple CarPlay</Text>
          <Badge label="Car screen only" tone="gray" />
        </Row>
        <Text style={[text.body, { marginTop: 6 }]}>
          On CarPlay, EVWorld shows chargers for your car and your trip status on the car's screen. Apple does not let apps read the battery through CarPlay, so on
          iPhone the live battery % comes from a connected-car account, an OBD dongle or your own input.
        </Text>
        <Divider />
        <Row>
          <Ionicons name="logo-android" size={22} color={colors.primaryDark} />
          <Text style={[text.h3, { flex: 1 }]}>Android Auto</Text>
          <Badge label="Car screen + battery" tone="green" />
        </Row>
        <Text style={[text.body, { marginTop: 6 }]}>
          On Android Auto, EVWorld shows the same screens, and it can also read the battery % from cars that share it with Android Auto.
        </Text>
        <Button title="Preview the car screen" icon="tv-outline" kind="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/car-display')} />
      </Card>

      {Platform.OS === 'web' ? <Banner text="You're using the web demo. The car connections run in the iPhone and Android apps." /> : null}
    </Screen>
  );
}
