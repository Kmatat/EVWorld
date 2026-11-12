import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { BatteryHealthBadge, VendorRow } from '@/components/market';
import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Card, Divider, Field, Row, Screen, text } from '@/components/ui';
import { formatKm } from '@/core/geo';
import { CAR_LISTING_FEES, formatEgp } from '@/core/marketplace';
import { estimateRange } from '@/core/range';
import { roadKm } from '@/core/roads';
import { Vehicle } from '@/core/types';
import { carById, SHOPS, vendorById } from '@/data/marketplace';
import { placeById } from '@/data/places';
import { useAppStore } from '@/store/useAppStore';
import { colors, space } from '@/theme';

/** Popular trips used to answer "can this car do my trips?" */
const TRIPS: [string, string][] = [
  ['downtown', 'alex'],
  ['downtown', 'alamein'],
  ['new-cairo', 'sokhna'],
  ['downtown', 'hurghada'],
];

export default function CarDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const car = carById(String(id));
  const saved = useAppStore((s) => s.savedCars.includes(String(id)));
  const toggleSaved = useAppStore((s) => s.toggleSavedCar);
  const addInquiry = useAppStore((s) => s.addInquiry);
  const [offer, setOffer] = useState('');
  const [showOffer, setShowOffer] = useState(false);

  if (!car) return <Screen><Banner tone="amber" text="Listing not found." /></Screen>;
  const vendor = vendorById(car.vendorId)!;

  // Reuse the range engine: treat the listing as a vehicle whose battery has aged.
  const health = (car.batteryHealthPercent ?? 90) / 100;
  const asVehicle: Vehicle = { id: car.id, make: car.make, model: car.model, usableKwh: 60 * health, wltpKm: car.rangeKm * health, maxDcKw: 100, maxAcKw: 11, acConnector: 'type2', dcConnector: 'ccs2' };
  const highway = estimateRange(asVehicle, 100, { profile: 'highway', temperatureC: 32, climateOn: true, style: 'normal', passengers: 2 }, 10);
  const city = estimateRange(asVehicle, 100, { profile: 'city', temperatureC: 32, climateOn: true, style: 'normal', passengers: 1 }, 10);
  const inspectionShop = SHOPS.find((s) => s.services.some((x) => x.name.toLowerCase().includes('battery')));

  return (
    <Screen>
      <Stack.Screen options={{ title: `${car.year} ${car.make} ${car.model}` }} />
      <View style={{ height: 170, borderRadius: 16, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="car-sport" size={96} color="rgba(17,24,39,0.7)" />
        <Text style={[text.small, { position: 'absolute', bottom: 8 }]}>Photos are uploaded by the seller in the live app</Text>
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={text.h2}>
              {car.year} {car.make} {car.model}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 4 }}>{formatEgp(car.priceEgp)}</Text>
          </View>
          <Button
            title={saved ? 'Saved' : 'Save'}
            icon={saved ? 'heart' : 'heart-outline'}
            kind="ghost"
            onPress={() => toggleSaved(car.id)}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          />
        </Row>
        <Row gap={6} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          <BatteryHealthBadge car={car} />
          <Badge label={car.sellerKind === 'dealer' ? 'Dealer / agent' : 'Private owner'} tone={car.sellerKind === 'dealer' ? 'blue' : 'gray'} />
          {car.warrantyMonths ? <Badge label={`${car.warrantyMonths} months warranty`} tone="green" icon="shield-checkmark-outline" /> : null}
        </Row>
        <Divider />
        <Spec label="Mileage" value={`${car.km.toLocaleString('en-US')} km`} />
        <Spec label="Location" value={car.city} />
        <Spec label="Spec / origin" value={car.spec} />
        <Spec label="Charging plugs" value={car.connector} />
        <Spec label="Official range (new)" value={`${car.rangeKm} km`} />
        <Spec label="Colour" value={car.color} />
        <Spec label="Posted" value={car.postedDaysAgo === 1 ? 'Yesterday' : `${car.postedDaysAgo} days ago`} />
        <Text style={[text.body, { marginTop: space.md }]}>{car.description}</Text>
        {car.spec === 'China spec' ? (
          <Banner tone="amber" icon="information-circle-outline" text="China-spec cars use GB/T plugs. Most public fast chargers in Egypt are CCS2, so budget for an adapter (available in the Market)." />
        ) : null}
      </Card>

      <Card>
        <Text style={text.h3}>Can this car do your trips?</Text>
        <Text style={[text.small, { marginTop: 2 }]}>
          Real-world estimate with {Math.round(health * 100)}% battery health, starting at 100% and keeping a 10% reserve.
        </Text>
        <Row style={{ marginTop: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={text.price}>{formatKm(highway.safeRangeKm)}</Text>
            <Text style={text.small}>Highway, AC on</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={text.price}>{formatKm(city.safeRangeKm)}</Text>
            <Text style={text.small}>City, AC on</Text>
          </View>
        </Row>
        <Divider />
        {TRIPS.map(([a, b]) => {
          const km = roadKm(placeById(a)!.location, placeById(b)!.location);
          const ok = km <= highway.safeRangeKm;
          return (
            <Row key={a + b} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text style={[text.body, { flex: 1 }]}>
                {placeById(a)!.name.split(' (')[0]} → {placeById(b)!.name.split(' (')[0]} ({formatKm(km)})
              </Text>
              {ok ? <Badge label="No charging" tone="green" icon="checkmark-circle" /> : <Badge label="1+ stop" tone="amber" icon="flash-outline" />}
            </Row>
          );
        })}
      </Card>

      {inspectionShop ? (
        <Card style={{ backgroundColor: colors.blueSoft }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Ionicons name="ribbon-outline" size={24} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={text.strong}>Check the battery before you buy</Text>
              <Text style={[text.small, { marginTop: 2 }]}>
                The battery is the most expensive part of an EV. Book a certified battery-health report ({formatEgp(CAR_LISTING_FEES.inspectionReport)}) at {inspectionShop.title}.
              </Text>
              <Button
                title="Book battery inspection"
                kind="secondary"
                style={{ marginTop: space.sm, alignSelf: 'flex-start', paddingVertical: 9 }}
                onPress={() => {
                  addInquiry({ carId: car.id, kind: 'inspection' });
                  router.push(`/marketplace/shop/${inspectionShop.id}?service=${encodeURIComponent(inspectionShop.services.find((x) => x.name.toLowerCase().includes('battery'))!.name)}`);
                }}
              />
            </View>
          </Row>
        </Card>
      ) : null}

      <VendorRow vendor={vendor} />

      <View style={{ gap: space.sm }}>
        <Button
          title="Message seller on WhatsApp"
          icon="logo-whatsapp"
          onPress={() => {
            addInquiry({ carId: car.id, kind: 'message' });
            toast('Demo: this opens a WhatsApp chat with the seller (phone number stays private)');
          }}
        />
        <Button title="Make an offer" icon="pricetag-outline" kind="secondary" onPress={() => setShowOffer((v) => !v)} />
      </View>

      {showOffer ? (
        <Card>
          <Field label="Your offer (EGP)" value={offer} onChangeText={(t) => setOffer(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder={String(Math.round(car.priceEgp * 0.95))} />
          <Button
            title="Send offer"
            disabled={!offer}
            onPress={() => {
              addInquiry({ carId: car.id, kind: 'offer', offerEgp: Number(offer) });
              setShowOffer(false);
              toast(`Offer of ${formatEgp(Number(offer))} sent to the seller`);
            }}
          />
        </Card>
      ) : null}
      <Text style={[text.small, { textAlign: 'center' }]}>Safety tip: inspect the car and its papers in person. Never pay a deposit before seeing the car.</Text>
    </Screen>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={text.small}>{label}</Text>
      <Text style={[text.body, { color: colors.ink, fontWeight: '600' }]}>{value}</Text>
    </Row>
  );
}
