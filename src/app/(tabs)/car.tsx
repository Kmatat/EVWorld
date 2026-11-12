import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import BatteryControl from '@/components/BatteryControl';
import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Card, Chip, Divider, Field, ListRow, Row, Screen, SectionTitle, text } from '@/components/ui';
import { formatAddress, maskPhone } from '@/core/identity';
import { formatEgp } from '@/core/marketplace';
import { CONNECTOR_LABEL, ConnectorType, Vehicle } from '@/core/types';
import { carById, shopById, vendorById } from '@/data/marketplace';
import { stationById } from '@/data/stations';
import { VEHICLES } from '@/data/vehicles';
import { linkLabel, VEHICLE_LINKS } from '@/services/vehicleData';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { useAuthStore, useDefaultAddress } from '@/store/useAuthStore';
import { useCommunityStore } from '@/store/useCommunityStore';
import { colors, space } from '@/theme';

export default function MyEvScreen() {
  const vehicle = useVehicle();
  const setVehicle = useAppStore((s) => s.setVehicle);
  const [choosing, setChoosing] = useState(false);
  const [custom, setCustom] = useState(false);
  const orders = useAppStore((s) => s.orders);
  const bookings = useAppStore((s) => s.bookings);
  const inquiries = useAppStore((s) => s.inquiries);
  const watched = useAppStore((s) => s.watchedStations);
  const reports = useAppStore((s) => s.reports);
  const savedCars = useAppStore((s) => s.savedCars);
  const applications = useAppStore((s) => s.applications);

  const makes = [...new Set(VEHICLES.map((v) => v.make))];
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const addressCount = useAuthStore((s) => s.addresses.length);
  const defaultAddress = useDefaultAddress();
  const link = useAppStore((s) => s.vehicleLink);
  const factor = useAppStore((s) => s.consumptionFactor[vehicle.id]);
  const hostedCount = useCommunityStore((s) => s.hosted.length);
  const communityBookings = useCommunityStore((s) => s.bookings.length);

  return (
    <Screen>
      {user ? (
        <Card>
          <Row>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{(user.name || 'E')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={text.h3}>{user.name || 'EVWorld driver'}</Text>
              <Text style={text.small}>
                {user.provider === 'apple' ? 'Apple' : 'Google'} account{user.email ? ` · ${user.email}` : ''}
              </Text>
            </View>
          </Row>
          <Divider />
          <ListRow
            icon="call-outline"
            title={user.phone ? maskPhone(user.phone) : 'Mobile number required'}
            subtitle={user.phoneVerified ? 'Verified · private, never shown to other users' : 'Verify to order, chat and host'}
            right={user.phoneVerified ? <Badge label="Verified" tone="green" /> : undefined}
            onPress={user.phoneVerified ? undefined : () => router.push('/auth/phone')}
          />
          <ListRow
            icon="location-outline"
            title={`Delivery addresses (${addressCount})`}
            subtitle={defaultAddress ? formatAddress(defaultAddress) : 'Add one for marketplace deliveries'}
            onPress={() => router.push('/account/addresses')}
          />
          <Pressable onPress={signOut} style={{ marginTop: space.sm }} hitSlop={6}>
            <Text style={{ color: colors.red, fontWeight: '600' }}>Sign out</Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <Text style={text.h3}>Sign in to EVWorld</Text>
          <Text style={[text.body, { marginTop: 4 }]}>Use Apple or Google. Then verify your mobile to order, chat with hosts and sellers, and share your charger.</Text>
          <Button title="Sign in" icon="person-circle-outline" style={{ marginTop: space.md }} onPress={() => router.push('/auth/sign-in')} />
        </Card>
      )}

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="car-sport" size={28} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.small}>My car</Text>
            <Text style={text.h2}>
              {vehicle.make} {vehicle.model}
            </Text>
            {vehicle.note ? <Text style={[text.small, { color: colors.amber }]}>{vehicle.note}</Text> : null}
          </View>
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: space.md }}>
          <Badge label={`${vehicle.usableKwh} kWh battery`} tone="gray" />
          <Badge label={`${vehicle.wltpKm} km WLTP`} tone="gray" />
          <Badge label={`DC up to ${vehicle.maxDcKw} kW`} tone="blue" />
          <Badge label={`AC ${vehicle.maxAcKw} kW`} tone="blue" />
          <Badge label={CONNECTOR_LABEL[vehicle.acConnector]} tone="purple" />
          {vehicle.dcConnector ? <Badge label={CONNECTOR_LABEL[vehicle.dcConnector]} tone="purple" /> : null}
        </Row>
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <Button title={choosing ? 'Close list' : 'Change car'} kind="secondary" style={{ flex: 1, paddingVertical: 10 }} onPress={() => setChoosing((v) => !v)} />
          <Button title="Custom car" kind="ghost" style={{ flex: 1, paddingVertical: 10 }} onPress={() => setCustom((v) => !v)} />
        </Row>
      </Card>

      {choosing ? (
        <Card style={{ paddingVertical: space.sm }}>
          {makes.map((make) => (
            <View key={make}>
              <Text style={[text.small, { marginTop: space.md, fontWeight: '700', color: colors.inkSoft }]}>{make}</Text>
              {VEHICLES.filter((v) => v.make === make).map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    setVehicle(v.id);
                    setChoosing(false);
                    toast(`Switched to ${v.make} ${v.model}`);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 }}
                >
                  <Ionicons name={vehicle.id === v.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={vehicle.id === v.id ? colors.primary : colors.faint} />
                  <Text style={[text.body, { flex: 1, color: colors.ink }]}>{v.model}</Text>
                  <Text style={text.small}>
                    {v.usableKwh} kWh · {v.dcConnector ? CONNECTOR_LABEL[v.dcConnector].split(' ')[0] : 'AC only'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Text style={[text.small, { marginTop: space.md }]}>Specs are typical values for each model; trims and markets vary.</Text>
        </Card>
      ) : null}

      {custom ? <CustomVehicleForm onDone={() => setCustom(false)} /> : null}

      <BatteryControl compact />

      <Card style={{ paddingVertical: space.sm }}>
        <ListRow
          icon="sync-outline"
          title="Car connection"
          subtitle={`${VEHICLE_LINKS.find((l) => l.id === link)?.title} · battery ${linkLabel(link)}${factor ? ` · learned use ${factor >= 1 ? '+' : ''}${Math.round((factor - 1) * 100)}%` : ''}`}
          onPress={() => router.push('/car-connection')}
        />
        <Divider />
        <ListRow icon="tv-outline" iconColor={colors.blue} title="CarPlay & Android Auto" subtitle="Preview what EVWorld shows on your car's screen" onPress={() => router.push('/car-display')} />
        <Divider />
        <ListRow
          icon="home-outline"
          iconColor={colors.purple}
          title="Community charging"
          subtitle={hostedCount ? `${hostedCount} shared charger${hostedCount > 1 ? 's' : ''} · ${communityBookings} sessions & requests` : 'Share your charger and earn per kWh'}
          onPress={() => router.push(hostedCount || communityBookings ? '/community/mine' : '/community/host')}
        />
      </Card>

      <SectionTitle title="My activity" />
      <Card style={{ paddingVertical: space.sm }}>
        <ListRow icon="receipt-outline" title={`Orders (${orders.length})`} subtitle={orders[0] ? `Latest #${orders[0].id} · ${vendorById(orders[0].vendorId)?.name} · ${formatEgp(orders[0].total)}` : 'Nothing ordered yet'} onPress={() => router.push('/marketplace/products')} />
        <Divider />
        <ListRow icon="calendar-outline" iconColor={colors.blue} title={`Service bookings (${bookings.length})`} subtitle={bookings[0] ? `${bookings[0].service} · ${shopById(bookings[0].shopId)?.title} · ${bookings[0].date} ${bookings[0].time}` : 'Book a workshop in the Market'} onPress={() => router.push('/marketplace/shops')} />
        <Divider />
        <ListRow icon="chatbubble-ellipses-outline" iconColor={colors.amber} title={`Car enquiries & offers (${inquiries.length})`} subtitle={inquiries[0] ? `${inquiries[0].kind} · ${carById(inquiries[0].carId)?.make} ${carById(inquiries[0].carId)?.model}` : 'Message sellers from any car listing'} onPress={() => router.push('/marketplace/cars')} />
        <Divider />
        <ListRow icon="heart-outline" iconColor={colors.red} title={`Saved cars (${savedCars.length})`} subtitle={savedCars.map((id) => `${carById(id)?.make} ${carById(id)?.model}`).join(', ') || 'Tap the heart on a listing'} />
        <Divider />
        <ListRow icon="notifications-outline" iconColor={colors.purple} title={`Charger alerts (${watched.length})`} subtitle={watched.map((id) => stationById(id)?.name).join(', ') || 'Get notified when a busy charger frees up'} />
        <Divider />
        <ListRow icon="flag-outline" iconColor={colors.inkSoft} title={`Reports sent (${reports.length})`} subtitle={reports[0] ? `${reports[0].issue} · ${stationById(reports[0].stationId)?.name}` : 'Help keep charger data accurate'} />
        <Divider />
        <ListRow icon="storefront-outline" iconColor={colors.primary} title={`Seller applications (${applications.length})`} subtitle={applications[0] ? `${applications[0].title} · pending review` : 'Sell products, services or your car'} onPress={() => router.push('/marketplace/sell')} />
      </Card>

      <Banner text="Demo build. All chargers, operators, sellers, products and prices are fictional sample data. No payments are processed." />
    </Screen>
  );
}

const AC_TYPES: ConnectorType[] = ['type2', 'gbt_ac'];
const DC_TYPES: (ConnectorType | 'none')[] = ['ccs2', 'gbt_dc', 'chademo', 'none'];

function CustomVehicleForm({ onDone }: { onDone: () => void }) {
  const setCustomVehicle = useAppStore((s) => s.setCustomVehicle);
  const [name, setName] = useState('');
  const [kwh, setKwh] = useState('');
  const [range, setRange] = useState('');
  const [dcKw, setDcKw] = useState('100');
  const [acKw, setAcKw] = useState('11');
  const [ac, setAc] = useState<ConnectorType>('type2');
  const [dc, setDc] = useState<ConnectorType | 'none'>('ccs2');
  const num = (t: string) => t.replace(/[^0-9.]/g, '');
  const valid = name && Number(kwh) > 5 && Number(range) > 50;

  return (
    <Card>
      <Text style={text.h3}>Add a custom car</Text>
      <Text style={[text.small, { marginBottom: space.md }]}>Find these numbers in your car's manual or the manufacturer's website.</Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Zeekr 001" />
      <Row gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Field label="Usable battery (kWh)" value={kwh} onChangeText={(t) => setKwh(num(t))} keyboardType="decimal-pad" placeholder="75" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Official range (km)" value={range} onChangeText={(t) => setRange(num(t))} keyboardType="number-pad" placeholder="500" />
        </View>
      </Row>
      <Row gap={space.sm}>
        <View style={{ flex: 1 }}>
          <Field label="Max DC power (kW)" value={dcKw} onChangeText={(t) => setDcKw(num(t))} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Max AC power (kW)" value={acKw} onChangeText={(t) => setAcKw(num(t))} keyboardType="decimal-pad" />
        </View>
      </Row>
      <Text style={[text.small, { marginBottom: 6, fontWeight: '600', color: colors.inkSoft }]}>AC plug</Text>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {AC_TYPES.map((t) => (
          <Chip key={t} label={CONNECTOR_LABEL[t]} selected={ac === t} onPress={() => setAc(t)} />
        ))}
      </Row>
      <Text style={[text.small, { marginBottom: 6, marginTop: space.md, fontWeight: '600', color: colors.inkSoft }]}>DC fast-charge plug</Text>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {DC_TYPES.map((t) => (
          <Chip key={t} label={t === 'none' ? 'None' : CONNECTOR_LABEL[t]} selected={dc === t} onPress={() => setDc(t)} />
        ))}
      </Row>
      <Button
        title="Save car"
        style={{ marginTop: space.lg }}
        disabled={!valid}
        onPress={() => {
          const v: Vehicle = {
            id: 'custom',
            make: 'Custom',
            model: name,
            usableKwh: Number(kwh),
            wltpKm: Number(range),
            maxDcKw: Number(dcKw) || 50,
            maxAcKw: Number(acKw) || 7,
            acConnector: ac,
            dcConnector: dc === 'none' ? null : dc,
          };
          setCustomVehicle(v);
          toast(`Saved ${name}`);
          onDone();
        }}
      />
    </Card>
  );
}
