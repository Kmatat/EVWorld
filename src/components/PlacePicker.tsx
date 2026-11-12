import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PLACES } from '@/data/places';
import { STATIONS } from '@/data/stations';
import { colors, radius, space } from '@/theme';

import { ListRow, SearchBox } from './ui';

export default function PlacePicker({
  visible,
  title,
  allowGps,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  allowGps?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const places = PLACES.filter((p) => match(`${p.name} ${p.region}`));
  const chargers = q.trim().length >= 2 ? STATIONS.filter((s) => match(`${s.name} ${s.city}`)).slice(0, 8) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <SearchBox value={q} onChangeText={setQ} placeholder="Search city or charger" autoFocus />
          <ScrollView style={{ marginTop: space.sm }} keyboardShouldPersistTaps="handled">
            {allowGps ? <ListRow icon="locate" iconColor={colors.blue} title="My current location" subtitle="Uses GPS" onPress={() => onPick('gps')} /> : null}
            {places.map((p) => (
              <ListRow key={p.id} icon="location-outline" title={p.name} subtitle={p.region} onPress={() => onPick(p.id)} />
            ))}
            {chargers.map((s) => (
              <ListRow key={s.id} icon="flash-outline" iconColor={colors.purple} title={s.name} subtitle={`Charger · ${s.city}`} onPress={() => onPick(`station:${s.id}`)} />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, maxHeight: '85%', width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
});
