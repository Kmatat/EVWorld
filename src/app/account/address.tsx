import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { toast } from '@/components/Toast';
import { Button, Card, Chip, Field, Row, Screen, text } from '@/components/ui';
import { Address, AddressErrors, Governorate, GOVERNORATES, validateAddress } from '@/core/identity';
import { useUserLocation } from '@/hooks/useUserLocation';
import { newId } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { colors, radius, space } from '@/theme';

export default function AddressForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useAuthStore((s) => s.addresses.find((a) => a.id === id));
  const save = useAuthStore((s) => s.saveAddress);
  const gps = useUserLocation({ auto: false });
  const [a, setA] = useState<Partial<Address>>(existing ?? { label: 'Home', governorate: '', isDefault: false });
  const [errors, setErrors] = useState<AddressErrors>({});
  const [pickGov, setPickGov] = useState(false);
  const set = (patch: Partial<Address>) => setA((prev) => ({ ...prev, ...patch }));

  const submit = () => {
    const e = validateAddress(a);
    setErrors(e);
    if (Object.keys(e).length) return;
    save({ ...(a as Address), id: a.id ?? newId('AD') });
    toast('Address saved');
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit address' : 'New address' }} />
      <Card>
        <Row gap={6}>
          {(['Home', 'Work', 'Other'] as const).map((l) => (
            <Chip key={l} label={l} selected={a.label === l} onPress={() => set({ label: l })} />
          ))}
        </Row>
        <View style={{ height: space.md }} />
        <Text style={styles.label}>Governorate</Text>
        <Pressable onPress={() => setPickGov(true)} style={[styles.select, errors.governorate && { borderColor: colors.red }]}>
          <Text style={{ color: a.governorate ? colors.ink : colors.faint, fontSize: 15 }}>{a.governorate || 'Choose governorate'}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
        {errors.governorate ? <Text style={styles.error}>{errors.governorate}</Text> : null}
        <View style={{ height: space.md }} />
        <Field label="City / area" value={a.city ?? ''} onChangeText={(t) => set({ city: t })} placeholder="e.g. New Cairo, 5th Settlement" />
        {errors.city ? <Text style={[styles.error, { marginTop: -8 }]}>{errors.city}</Text> : null}
        <Field label="Street" value={a.street ?? ''} onChangeText={(t) => set({ street: t })} placeholder="e.g. 90th Street" />
        {errors.street ? <Text style={[styles.error, { marginTop: -8 }]}>{errors.street}</Text> : null}
        <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1.2 }}>
            <Field label="Building" value={a.building ?? ''} onChangeText={(t) => set({ building: t })} placeholder="No. / name" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Floor" value={a.floor ?? ''} onChangeText={(t) => set({ floor: t })} placeholder="3" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Apartment" value={a.apartment ?? ''} onChangeText={(t) => set({ apartment: t })} placeholder="7" />
          </View>
        </Row>
        {errors.building ? <Text style={[styles.error, { marginTop: -8 }]}>{errors.building}</Text> : null}
        <Field label="Landmark (helps the courier)" value={a.landmark ?? ''} onChangeText={(t) => set({ landmark: t })} placeholder="e.g. behind Point 90 Mall, next to the pharmacy" />
        <Button
          title={a.location ? 'Map pin saved ✓  (tap to update)' : 'Pin my current location'}
          icon="locate-outline"
          kind="ghost"
          onPress={async () => {
            const r = await gps.request();
            if (r.source === 'gps') {
              set({ location: r.location });
              toast('Location pinned');
            } else toast('GPS is not available here. The courier will use the written address.');
          }}
        />
        <Pressable onPress={() => set({ isDefault: !a.isDefault })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.md }}>
          <Ionicons name={a.isDefault ? 'checkbox' : 'square-outline'} size={22} color={a.isDefault ? colors.primary : colors.faint} />
          <Text style={text.body}>Use as my default delivery address</Text>
        </Pressable>
      </Card>
      <Button title="Save address" onPress={submit} />

      <Modal visible={pickGov} transparent animationType="slide" onRequestClose={() => setPickGov(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
              <Text style={text.h3}>Governorate</Text>
              <Pressable onPress={() => setPickGov(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </Row>
            <ScrollView>
              {GOVERNORATES.map((g: Governorate) => (
                <Pressable
                  key={g}
                  onPress={() => {
                    set({ governorate: g });
                    setPickGov(false);
                  }}
                  style={styles.govRow}
                >
                  <Text style={[text.body, { color: colors.ink }]}>{g}</Text>
                  {a.governorate === g ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.card },
  error: { color: colors.red, fontSize: 12, marginTop: 4, marginBottom: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, maxHeight: '75%', width: '100%', maxWidth: 760, alignSelf: 'center' },
  govRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
