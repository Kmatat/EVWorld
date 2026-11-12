import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';

import { toast } from '@/components/Toast';
import { Badge, Banner, Button, Chip, Divider, Field, Row, text } from '@/components/ui';
import { canSeePrivateDetails, measureSessionKwh, nextBookingActions, quoteSession } from '@/core/community';
import { formatEgp } from '@/core/marketplace';
import { useVehicle } from '@/store/useAppStore';
import { communityChargerById, CommunityBooking, useCommunityStore } from '@/store/useCommunityStore';
import { colors, radius, space } from '@/theme';
import { openNavigation } from '@/utils/locations';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useCommunityStore((s) => s.conversations.find((c) => c.id === id));
  const allMessages = useCommunityStore((s) => s.messages);
  const bookings = useCommunityStore((s) => s.bookings);
  const send = useCommunityStore((s) => s.send);
  const markRead = useCommunityStore((s) => s.markRead);
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const messages = useMemo(() => allMessages.filter((m) => m.conversationId === id), [allMessages, id]);
  const booking = bookings.find((b) => b.id === conversation?.bookingId);

  useEffect(() => {
    markRead(String(id));
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, id, markRead]);

  if (!conversation) {
    return (
      <View style={{ padding: space.lg }}>
        <Banner tone="amber" text="This conversation could not be found." />
      </View>
    );
  }

  const submit = () => {
    if (!draft.trim()) return;
    const { masked } = send(conversation.id, draft);
    setDraft('');
    if (masked) toast('Contact details were hidden. Keep chats in EVWorld for your protection.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: conversation.counterpartName }} />
      <Pressable
        onPress={() => router.push(conversation.kind === 'community' ? `/community/${conversation.subjectId}` : `/marketplace/car/${conversation.subjectId}`)}
        style={styles.subject}
      >
        <Ionicons name={conversation.kind === 'community' ? 'home' : 'car-sport'} size={16} color={conversation.kind === 'community' ? colors.purple : colors.amber} />
        <Text style={[text.small, { flex: 1, color: colors.inkSoft }]} numberOfLines={1}>
          {conversation.title}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
      </Pressable>
      {booking ? <BookingPanel booking={booking} /> : null}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.sm, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <View style={styles.notice}>
          <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
          <Text style={[text.small, { flex: 1 }]}>Phone numbers, emails and social links are hidden in EVWorld chats. Never pay outside the app.</Text>
        </View>
        {messages.map((m) =>
          m.from === 'system' ? (
            <Text key={m.id} style={styles.system}>
              {m.text}
            </Text>
          ) : (
            <View key={m.id} style={[styles.bubble, m.from === 'me' ? styles.mine : styles.theirs]}>
              <Text style={{ color: m.from === 'me' ? '#fff' : colors.ink, fontSize: 15, lineHeight: 20 }}>{m.text}</Text>
              {m.masked ? <Text style={{ color: m.from === 'me' ? '#D1FAE5' : colors.muted, fontSize: 11, marginTop: 4 }}>Contact details hidden</Text> : null}
            </View>
          ),
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Write a message" placeholderTextColor={colors.faint} style={styles.input} onSubmitEditing={submit} returnKeyType="send" multiline={false} />
        <Pressable onPress={submit} style={[styles.send, !draft.trim() && { opacity: 0.4 }]} accessibilityLabel="Send message">
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const STATUS_LABEL = { requested: 'Waiting for host', accepted: 'Accepted', charging: 'Charging', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' } as const;
const STATUS_TONE = { requested: 'amber', accepted: 'blue', charging: 'blue', completed: 'green', declined: 'gray', cancelled: 'gray' } as const;

/** The booking card pinned above a community chat: what can happen next depends on who you are. */
function BookingPanel({ booking }: { booking: CommunityBooking }) {
  const setStatus = useCommunityStore((s) => s.setBookingStatus);
  const complete = useCommunityStore((s) => s.completeBooking);
  const rate = useCommunityStore((s) => s.rateBooking);
  const vehicle = useVehicle();
  const charger = communityChargerById(booking.chargerId);
  const [finishing, setFinishing] = useState(false);
  const [method, setMethod] = useState<'meter' | 'timer'>('meter');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [minutes, setMinutes] = useState('120');
  const actions = nextBookingActions(booking.status, booking.myRole);
  const price = charger?.pricePerKwh ?? 3;

  const measured =
    method === 'meter'
      ? measureSessionKwh({ method: 'meter', startReading: Number(start), endReading: Number(end) })
      : measureSessionKwh({ method: 'timer', minutes: Number(minutes), chargerKw: charger?.powerKw ?? 7, carMaxAcKw: vehicle.maxAcKw });
  const canPay = method === 'meter' ? start !== '' && end !== '' && !measured.error : !measured.error;
  const quote = quoteSession(measured.kWh, price);

  return (
    <View style={styles.panel}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={text.strong}>
          {booking.slotLabel} · {booking.kWh ?? booking.estKwh} kWh
        </Text>
        <Badge label={STATUS_LABEL[booking.status]} tone={STATUS_TONE[booking.status]} />
      </Row>
      {charger && canSeePrivateDetails(booking.status) && booking.myRole === 'driver' && booking.status !== 'completed' ? (
        <>
          <Text style={[text.small, { marginTop: 6 }]}>Access: {charger.accessInstructions}</Text>
          <Pressable onPress={() => openNavigation(charger.location)} style={{ marginTop: 4 }}>
            <Text style={{ color: colors.primaryDark, fontWeight: '600', fontSize: 13 }}>Navigate to the exact location →</Text>
          </Pressable>
        </>
      ) : null}

      {booking.status === 'completed' && booking.quote ? (
        <View style={{ marginTop: 6 }}>
          <Text style={text.small}>
            {booking.myRole === 'driver'
              ? `Paid ${formatEgp(booking.quote.total)} for ${booking.quote.kWh} kWh`
              : `You earned ${formatEgp(booking.quote.hostEarnings)} for ${booking.quote.kWh} kWh`}
          </Text>
          {booking.rating ? (
            <Text style={[text.small, { marginTop: 4 }]}>You rated {booking.myRole === 'driver' ? 'this host' : 'this driver'} {booking.rating}★</Text>
          ) : (
            <Row gap={4} style={{ marginTop: 6 }}>
              <Text style={text.small}>Rate {booking.counterpartName}:</Text>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => rate(booking.id, n)} hitSlop={4} accessibilityLabel={`${n} stars`}>
                  <Ionicons name="star-outline" size={20} color="#F59E0B" />
                </Pressable>
              ))}
            </Row>
          )}
        </View>
      ) : null}

      {!finishing && actions.length ? (
        <Row gap={space.sm} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
          {actions.includes('accepted') ? <Button title="Accept" icon="checkmark" style={btn} onPress={() => setStatus(booking.id, 'accepted')} /> : null}
          {actions.includes('declined') ? <Button title="Decline" kind="ghost" style={btn} onPress={() => setStatus(booking.id, 'declined')} /> : null}
          {actions.includes('charging') ? <Button title="I've plugged in" icon="flash" style={btn} onPress={() => setStatus(booking.id, 'charging')} /> : null}
          {actions.includes('completed') ? <Button title="Finish & pay" icon="card-outline" style={btn} onPress={() => setFinishing(true)} /> : null}
          {actions.includes('cancelled') ? <Button title="Cancel" kind="ghost" style={btn} onPress={() => setStatus(booking.id, 'cancelled')} /> : null}
        </Row>
      ) : null}

      {finishing ? (
        <View style={{ marginTop: space.sm }}>
          <Divider />
          <Text style={text.strong}>How much was charged?</Text>
          <Row gap={6} style={{ marginVertical: space.sm }}>
            <Chip label="Meter readings" selected={method === 'meter'} onPress={() => setMethod('meter')} />
            <Chip label="Charging time" selected={method === 'timer'} onPress={() => setMethod('timer')} />
          </Row>
          {method === 'meter' ? (
            <Row gap={space.sm}>
              <View style={{ flex: 1 }}>
                <Field label="Start (kWh)" value={start} onChangeText={(t) => setStart(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="1520.4" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="End (kWh)" value={end} onChangeText={(t) => setEnd(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="1542.9" />
              </View>
            </Row>
          ) : (
            <Field label="Minutes charging" value={minutes} onChangeText={(t) => setMinutes(t.replace(/\D/g, ''))} keyboardType="number-pad" />
          )}
          {measured.error && (method === 'timer' || (start && end)) ? <Text style={{ color: colors.red, fontSize: 12, marginBottom: 6 }}>{measured.error}</Text> : null}
          <Text style={text.small}>
            {quote.kWh} kWh × EGP {price} = {formatEgp(quote.energyCost)} + service fee {formatEgp(quote.serviceFee)}
          </Text>
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <Button
              title={`Pay ${formatEgp(quote.total)}`}
              icon="lock-closed-outline"
              style={btn}
              disabled={!canPay || quote.kWh <= 0}
              onPress={() => {
                complete(booking.id, measured.kWh, price);
                setFinishing(false);
                toast('Payment complete (demo)');
              }}
            />
            <Button title="Back" kind="ghost" style={btn} onPress={() => setFinishing(false)} />
          </Row>
          <Text style={[text.small, { marginTop: 6 }]}>Smart chargers report kWh automatically. Otherwise share a photo of the meter before and after in the chat.</Text>
        </View>
      ) : null}
    </View>
  );
}

const btn = { paddingVertical: 9, paddingHorizontal: 14 };

const styles = StyleSheet.create({
  subject: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  panel: { backgroundColor: colors.card, padding: space.md, paddingHorizontal: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  notice: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', padding: space.sm, borderRadius: radius.sm, backgroundColor: '#EEF2F5' },
  system: { alignSelf: 'center', textAlign: 'center', fontSize: 12, color: colors.muted, backgroundColor: '#E9EDF1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, maxWidth: '90%' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: space.sm, paddingHorizontal: space.md, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.ink, backgroundColor: colors.bg },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
