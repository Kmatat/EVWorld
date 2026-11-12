import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { colors, radius } from '@/theme';

/**
 * Small confirmation message at the bottom of the screen. It works the same
 * on phones and the web (native alert pop-ups are often blocked on the web).
 */
const useToastStore = create<{ message?: string; key: number; show: (m: string) => void; hide: () => void }>((set) => ({
  message: undefined,
  key: 0,
  show: (message) => set((s) => ({ message, key: s.key + 1 })),
  hide: () => set({ message: undefined }),
}));

export const toast = (message: string) => useToastStore.getState().show(message);

export function ToastHost() {
  const { message, key, hide } = useToastStore();
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(hide, 3200);
    return () => clearTimeout(id);
  }, [message, key, hide]);
  if (!message) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.toast}>
        <Ionicons name="checkmark-circle" size={18} color="#6EE7B7" />
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center', paddingHorizontal: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, maxWidth: 520 },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
});

