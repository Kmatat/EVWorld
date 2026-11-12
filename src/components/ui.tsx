import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { batteryColor, colors, radius, shadow, space } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const inner = <View style={[styles.screenInner, padded && { padding: space.lg }]}>{children}</View>;
  if (!scroll) return <View style={styles.screen}>{inner}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.inkSoft} style={{ marginRight: 4 }} /> : null}
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.primary, secondary: colors.primarySoft, ghost: 'transparent', danger: colors.redSoft }[kind];
  const fg = { primary: '#fff', secondary: colors.primaryDark, ghost: colors.primaryDark, danger: colors.red }[kind];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.primarySoft, fg: colors.primaryDark },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  red: { bg: colors.redSoft, fg: colors.red },
  blue: { bg: colors.blueSoft, fg: colors.blue },
  gray: { bg: '#F3F4F6', fg: colors.inkSoft },
  purple: { bg: colors.purpleSoft, fg: colors.purple },
};

export function Badge({ label, tone = 'gray', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} style={{ marginRight: 3 }} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({ text, tone = 'blue', icon = 'information-circle-outline' }: { text: string; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Ionicons name={icon} size={18} color={t.fg} style={{ marginRight: 8, marginTop: 1 }} />
      <Text style={[styles.bannerText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function BatteryBar({ percent, height = 10, marker }: { percent: number; height?: number; marker?: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.batteryTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${p}%`, height, borderRadius: height / 2, backgroundColor: batteryColor(p) }} />
      {marker != null ? <View style={[styles.batteryMarker, { left: `${Math.max(0, Math.min(100, marker))}%`, height: height + 6 }]} /> : null}
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.md }} />;
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, suffix = '' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn} accessibilityLabel="Decrease" hitSlop={6}>
        <Ionicons name="remove" size={18} color={colors.ink} />
      </Pressable>
      <Text style={styles.stepValue}>
        {value}
        {suffix}
      </Text>
      <Pressable onPress={() => onChange(Math.min(max, value + step))} style={styles.stepBtn} accessibilityLabel="Increase" hitSlop={6}>
        <Ionicons name="add" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, props.multiline && { height: 90, textAlignVertical: 'top' }]} />
    </View>
  );
}

export function SearchBox(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={18} color={colors.muted} />
      <TextInput placeholderTextColor={colors.faint} {...props} style={styles.searchInput} />
    </View>
  );
}

export function ListRow({ icon, title, subtitle, right, onPress, iconColor = colors.primary }: { icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; iconColor?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]}>
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: iconColor + '1A' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function Stars({ rating, reviews }: { rating: number; reviews?: number }) {
  return (
    <Row gap={3}>
      <Ionicons name="star" size={13} color="#F59E0B" />
      <Text style={styles.small}>
        {rating.toFixed(1)}
        {reviews != null ? ` (${reviews})` : ''}
      </Text>
    </Row>
  );
}

export const text = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: colors.ink },
  h2: { fontSize: 19, fontWeight: '700', color: colors.ink },
  h3: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  small: { fontSize: 12, color: colors.muted },
  strong: { fontSize: 14, fontWeight: '700', color: colors.ink },
  price: { fontSize: 18, fontWeight: '800', color: colors.ink },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenInner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, ...shadow },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  link: { color: colors.primaryDark, fontWeight: '600', fontSize: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.md },
  buttonText: { fontSize: 15, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', padding: space.md, borderRadius: radius.md },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  stat: { flex: 1, alignItems: 'flex-start' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statSub: { fontSize: 11, color: colors.faint },
  batteryTrack: { backgroundColor: '#E5E7EB', overflow: 'visible', justifyContent: 'center' },
  batteryMarker: { position: 'absolute', width: 2, backgroundColor: colors.ink, marginLeft: -1 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.card },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  stepValue: { minWidth: 36, textAlign: 'center', fontWeight: '700', color: colors.ink },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.ink },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  listIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  listSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  small: { fontSize: 12, color: colors.muted },
});
