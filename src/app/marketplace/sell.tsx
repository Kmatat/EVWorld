import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { toast } from '@/components/Toast';
import { Banner, Button, Card, Chip, Divider, Field, Row, Screen, text } from '@/components/ui';
import { CAR_LISTING_FEES, COMMISSION_RATE, formatEgp, PRODUCT_CATEGORY_LABEL, ProductCategory, sellerEarnings } from '@/core/marketplace';
import { useAppStore } from '@/store/useAppStore';
import { colors, radius, space } from '@/theme';

type Mode = 'business' | 'car';
const BUSINESS_TYPES = ['Accessories store', 'Service center / workshop', 'Car dealer / agent', 'Charger installer'];

export default function SellScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'car' ? 'car' : 'business');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sell on EVWorld' }} />
      <Row gap={space.sm}>
        <ModeTile icon="storefront-outline" title="I'm a business" subtitle="Store, workshop or dealer" selected={mode === 'business'} onPress={() => setMode('business')} />
        <ModeTile icon="car-outline" title="Sell my car" subtitle="Private owner" selected={mode === 'car'} onPress={() => setMode('car')} />
      </Row>
      {mode === 'business' ? <BusinessForm /> : <CarForm />}
    </Screen>
  );
}

function BusinessForm() {
  const addApplication = useAppStore((s) => s.addApplication);
  const [type, setType] = useState(BUSINESS_TYPES[0]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [cr, setCr] = useState('');
  const [price, setPrice] = useState('10000');
  const [category, setCategory] = useState<ProductCategory | 'service'>('cables_adapters');
  const e = sellerEarnings(Number(price) || 0, category);

  return (
    <>
      <Card>
        <Text style={text.h3}>How selling works</Text>
        {[
          ['person-add-outline', 'Apply with your commercial register. We verify every business within 48 hours.'],
          ['pricetags-outline', 'List products or services yourself from the seller dashboard. No listing fees.'],
          ['cash-outline', 'We collect the payment. You get paid after delivery, minus a category commission.'],
          ['trending-up-outline', 'Optional: featured placement and ads to drivers whose car matches your product.'],
        ].map(([icon, line]) => (
          <Row key={line} style={{ marginTop: space.md, alignItems: 'flex-start' }}>
            <Ionicons name={icon as 'cash-outline'} size={20} color={colors.primary} />
            <Text style={[text.body, { flex: 1 }]}>{line}</Text>
          </Row>
        ))}
      </Card>

      <Card>
        <Text style={text.h3}>Earnings calculator</Text>
        <Field label="Item price (EGP)" value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        <Text style={[text.small, { marginBottom: 6, fontWeight: '600', color: colors.inkSoft }]}>Category</Text>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]).map((c) => (
            <Chip key={c} label={`${PRODUCT_CATEGORY_LABEL[c]} ${Math.round(COMMISSION_RATE[c] * 100)}%`} selected={category === c} onPress={() => setCategory(c)} />
          ))}
          <Chip label={`Services ${Math.round(COMMISSION_RATE.service * 100)}%`} selected={category === 'service'} onPress={() => setCategory('service')} />
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.body}>Customer pays</Text>
          <Text style={text.strong}>{formatEgp(e.price)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={text.body}>EVWorld commission ({Math.round(e.commissionRate * 100)}%)</Text>
          <Text style={[text.strong, { color: colors.red }]}>− {formatEgp(e.commission)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={text.strong}>You receive</Text>
          <Text style={[text.price, { color: colors.primaryDark }]}>{formatEgp(e.payout)}</Text>
        </Row>
        <Text style={[text.small, { marginTop: 6 }]}>Card and wallet fees are covered by EVWorld. Delivery fees go to you in full.</Text>
      </Card>

      <Card>
        <Text style={text.h3}>Apply to sell</Text>
        <Row gap={6} style={{ flexWrap: 'wrap', marginVertical: space.md }}>
          {BUSINESS_TYPES.map((t) => (
            <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
          ))}
        </Row>
        <Field label="Business name" value={name} onChangeText={setName} placeholder="e.g. Volt Garage" />
        <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. Alexandria" />
        <Field label="Mobile / WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01x xxxx xxxx" />
        <Field label="Commercial register number" value={cr} onChangeText={setCr} placeholder="Used for verification only" />
        <Button
          title="Submit application"
          disabled={!name || !city || !phone}
          onPress={() => {
            addApplication({ kind: 'business', title: `${name} (${type})` });
            toast('Application received. We will contact you within 48 hours.');
            router.back();
          }}
        />
      </Card>
    </>
  );
}

function CarForm() {
  const addApplication = useAppStore((s) => s.addApplication);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [km, setKm] = useState('');
  const [price, setPrice] = useState('');
  const [soh, setSoh] = useState('');
  const [featured, setFeatured] = useState(false);
  const [inspection, setInspection] = useState(true);
  const fees = (featured ? CAR_LISTING_FEES.ownerFeatured : 0) + (inspection ? CAR_LISTING_FEES.inspectionReport : 0);

  return (
    <>
      <Banner tone="green" icon="ribbon-outline" text="Cars with a certified battery report sell faster: battery health is the first thing EV buyers ask about." />
      <Card>
        <Text style={text.h3}>Your car</Text>
        <View style={{ marginTop: space.md }}>
          <Field label="Make" value={make} onChangeText={setMake} placeholder="e.g. BYD" />
          <Field label="Model" value={model} onChangeText={setModel} placeholder="e.g. Atto 3" />
          <Row gap={space.sm}>
            <View style={{ flex: 1 }}>
              <Field label="Year" value={year} onChangeText={(t) => setYear(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="2023" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Kilometres" value={km} onChangeText={(t) => setKm(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="30000" />
            </View>
          </Row>
          <Row gap={space.sm}>
            <View style={{ flex: 1 }}>
              <Field label="Asking price (EGP)" value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="1500000" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Battery health % (if known)" value={soh} onChangeText={(t) => setSoh(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="95" />
            </View>
          </Row>
        </View>
      </Card>

      <Card>
        <Text style={text.h3}>Listing options</Text>
        <Option title="Basic listing" subtitle="Visible to all buyers for 60 days" price="Free" selected disabled />
        <Option title="Featured" subtitle="Top of search + home page for 14 days" price={formatEgp(CAR_LISTING_FEES.ownerFeatured)} selected={featured} onPress={() => setFeatured((v) => !v)} />
        <Option title="Certified battery report" subtitle="Inspection at a partner workshop, badge on your listing" price={formatEgp(CAR_LISTING_FEES.inspectionReport)} selected={inspection} onPress={() => setInspection((v) => !v)} />
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={text.strong}>To pay now</Text>
          <Text style={text.price}>{fees ? formatEgp(fees) : 'Free'}</Text>
        </Row>
        <Text style={[text.small, { marginTop: 4 }]}>The sale itself happens between you and the buyer. EVWorld takes no commission on car sales.</Text>
      </Card>

      <Button
        title="Submit listing for review"
        disabled={!make || !model || !year || !price}
        onPress={() => {
          addApplication({ kind: 'car', title: `${year} ${make} ${model}`, plan: [featured && 'Featured', inspection && 'Battery report'].filter(Boolean).join(' + ') || 'Basic' });
          toast('Listing submitted. It goes live after a quick review.');
          router.back();
        }}
      />
    </>
  );
}

function ModeTile({ icon, title, subtitle, selected, onPress }: { icon: 'car-outline' | 'storefront-outline'; title: string; subtitle: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, padding: space.md, borderRadius: radius.lg, borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card }}
    >
      <Ionicons name={icon} size={26} color={selected ? colors.primaryDark : colors.inkSoft} />
      <Text style={[text.strong, { marginTop: 6 }]}>{title}</Text>
      <Text style={text.small}>{subtitle}</Text>
    </Pressable>
  );
}

function Option({ title, subtitle, price, selected, onPress, disabled }: { title: string; subtitle: string; price: string; selected: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
      <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? colors.primary : colors.faint} />
      <View style={{ flex: 1 }}>
        <Text style={text.strong}>{title}</Text>
        <Text style={text.small}>{subtitle}</Text>
      </View>
      <Text style={text.strong}>{price}</Text>
    </Pressable>
  );
}
