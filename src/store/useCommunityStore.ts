import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { BookingStatus, CommunityCharger, quoteSession, SessionQuote } from '@/core/community';
import { maskContactInfo } from '@/core/contactMasking';
import { DEMO_COMMUNITY_CHARGERS } from '@/data/community';

import { newId } from './useAppStore';
import { safeStorage } from './safeStorage';

/**
 * Community chargers, bookings and in-app chat.
 *
 * Production: these live on the server (see backend/supabase/schema.sql)
 * and messages arrive in real time. The server applies the same contact
 * masking and decides who may see exact locations. In the prototype
 * everything is stored on the phone, and the other person's replies are
 * simulated so the full flow can be tried by one person.
 */

export type ConversationKind = 'community' | 'car';
export type ChatRole = 'driver' | 'host' | 'buyer' | 'seller';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  /** Charger or car listing the chat is about. */
  subjectId: string;
  title: string;
  counterpartName: string;
  myRole: ChatRole;
  bookingId?: string;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  from: 'me' | 'them' | 'system';
  text: string;
  at: number;
  /** Contact details were removed from this message. */
  masked?: boolean;
}

export interface CommunityBooking {
  id: string;
  chargerId: string;
  conversationId: string;
  myRole: 'driver' | 'host';
  counterpartName: string;
  status: BookingStatus;
  slotLabel: string;
  estKwh: number;
  kWh?: number;
  quote?: SessionQuote;
  rating?: number;
  createdAt: number;
}

interface CommunityState {
  hosted: CommunityCharger[];
  bookings: CommunityBooking[];
  conversations: Conversation[];
  messages: ChatMessage[];
  lastReadAt: Record<string, number>;
  openConversation: (c: Omit<Conversation, 'id' | 'updatedAt'>) => string;
  send: (conversationId: string, text: string) => { masked: boolean };
  receive: (conversationId: string, text: string, from?: 'them' | 'system') => void;
  markRead: (conversationId: string) => void;
  requestBooking: (charger: CommunityCharger, details: { slotLabel: string; estKwh: number; note: string }) => string;
  setBookingStatus: (bookingId: string, status: BookingStatus) => void;
  completeBooking: (bookingId: string, kWh: number, pricePerKwh: number) => void;
  rateBooking: (bookingId: string, stars: number) => void;
  publishCharger: (c: CommunityCharger) => void;
  togglePause: (chargerId: string) => void;
}

const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

const STATUS_NOTE: Partial<Record<BookingStatus, string>> = {
  accepted: 'Request accepted. The exact location and access instructions are now visible.',
  declined: 'Request declined.',
  cancelled: 'Booking cancelled.',
  charging: 'Charging started.',
};

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => {
      /** Adds the user's own message (masked), without a demo reply. */
      const addMine = (conversationId: string, raw: string) => {
        const { text, masked } = maskContactInfo(raw.trim());
        if (!text) return { sent: false, masked: false };
        const msg: ChatMessage = { id: newId('M'), conversationId, from: 'me', text, at: Date.now(), masked };
        set({
          messages: [...get().messages, msg],
          conversations: get().conversations.map((c) => (c.id === conversationId ? { ...c, updatedAt: msg.at } : c)),
          lastReadAt: { ...get().lastReadAt, [conversationId]: msg.at },
        });
        return { sent: true, masked };
      };
      return {
      hosted: [],
      bookings: [],
      conversations: [],
      messages: [],
      lastReadAt: {},

      openConversation: (c) => {
        const existing = get().conversations.find((x) => x.kind === c.kind && x.subjectId === c.subjectId && x.myRole === c.myRole && x.counterpartName === c.counterpartName);
        if (existing) return existing.id;
        const conv: Conversation = { ...c, id: newId('CV'), updatedAt: Date.now() };
        set({ conversations: [conv, ...get().conversations] });
        return conv.id;
      },

      send: (conversationId, raw) => {
        const result = addMine(conversationId, raw);
        if (!result.sent) return { masked: false };
        // Demo: the other person answers.
        const conv = get().conversations.find((c) => c.id === conversationId);
        if (conv) {
          const reply =
            conv.kind === 'car'
              ? conv.myRole === 'buyer'
                ? 'Thanks for your message! The car is still available. When would you like to see it?'
                : 'Great, see you then.'
              : conv.myRole === 'driver'
                ? 'Sounds good 👍'
                : 'Perfect, thank you!';
          later(1800, () => get().receive(conversationId, reply));
        }
        return { masked: result.masked };
      },

      receive: (conversationId, raw, from = 'them') => {
        const { text, masked } = from === 'them' ? maskContactInfo(raw) : { text: raw, masked: false };
        const msg: ChatMessage = { id: newId('M'), conversationId, from, text, at: Date.now(), masked };
        set({
          messages: [...get().messages, msg],
          conversations: get().conversations.map((c) => (c.id === conversationId ? { ...c, updatedAt: msg.at } : c)),
        });
      },

      markRead: (conversationId) => set({ lastReadAt: { ...get().lastReadAt, [conversationId]: Date.now() } }),

      requestBooking: (charger, { slotLabel, estKwh, note }) => {
        const conversationId = get().openConversation({ kind: 'community', subjectId: charger.id, title: charger.title, counterpartName: charger.hostName, myRole: 'driver' });
        const booking: CommunityBooking = {
          id: newId('BKC'),
          chargerId: charger.id,
          conversationId,
          myRole: 'driver',
          counterpartName: charger.hostName,
          status: 'requested',
          slotLabel,
          estKwh,
          createdAt: Date.now(),
        };
        set({
          bookings: [booking, ...get().bookings],
          conversations: get().conversations.map((c) => (c.id === conversationId ? { ...c, bookingId: booking.id } : c)),
        });
        get().receive(conversationId, `Charging request sent for ${slotLabel} (about ${estKwh} kWh).`, 'system');
        if (note.trim()) addMine(conversationId, note);
        // Demo: the host accepts.
        later(2500, () => {
          get().setBookingStatus(booking.id, 'accepted');
          get().receive(conversationId, `Hi! Accepted, you're welcome to come. ${charger.accessInstructions}`);
        });
        return conversationId;
      },

      setBookingStatus: (bookingId, status) => {
        const b = get().bookings.find((x) => x.id === bookingId);
        if (!b) return;
        set({ bookings: get().bookings.map((x) => (x.id === bookingId ? { ...x, status } : x)) });
        const note = STATUS_NOTE[status];
        if (note) get().receive(b.conversationId, note, 'system');
      },

      completeBooking: (bookingId, kWh, pricePerKwh) => {
        const b = get().bookings.find((x) => x.id === bookingId);
        if (!b) return;
        const quote = quoteSession(kWh, pricePerKwh);
        set({ bookings: get().bookings.map((x) => (x.id === bookingId ? { ...x, status: 'completed', kWh: quote.kWh, quote } : x)) });
        get().receive(
          b.conversationId,
          b.myRole === 'driver'
            ? `Charging finished: ${quote.kWh} kWh. Paid EGP ${quote.total} (energy ${quote.energyCost} + service fee ${quote.serviceFee}).`
            : `Session finished: ${quote.kWh} kWh. You earned EGP ${quote.hostEarnings}.`,
          'system',
        );
      },

      rateBooking: (bookingId, stars) => set({ bookings: get().bookings.map((x) => (x.id === bookingId ? { ...x, rating: stars } : x)) }),

      publishCharger: (c) => {
        const isNew = !get().hosted.some((x) => x.id === c.id);
        set({ hosted: [c, ...get().hosted.filter((x) => x.id !== c.id)] });
        if (!isNew) return;
        // Demo: a driver nearby sends a request a few seconds after publishing.
        later(6000, () => {
          const conversationId = get().openConversation({ kind: 'community', subjectId: c.id, title: c.title, counterpartName: 'Omar K.', myRole: 'host' });
          const booking: CommunityBooking = {
            id: newId('BKC'),
            chargerId: c.id,
            conversationId,
            myRole: 'host',
            counterpartName: 'Omar K.',
            status: 'requested',
            slotLabel: 'Today, 21:00',
            estKwh: 20,
            createdAt: Date.now(),
          };
          set({
            bookings: [booking, ...get().bookings],
            conversations: get().conversations.map((x) => (x.id === conversationId ? { ...x, bookingId: booking.id } : x)),
          });
          get().receive(conversationId, 'New charging request for Today, 21:00 (about 20 kWh).', 'system');
          get().receive(conversationId, 'Hi! I drive an MG4 and need about 20 kWh tonight. Is 9 pm OK?');
        });
      },

      togglePause: (chargerId) => set({ hosted: get().hosted.map((c) => (c.id === chargerId ? { ...c, paused: !c.paused } : c)) }),
      };
    },
    { name: 'evworld-community-v1', storage: createJSONStorage(() => safeStorage) },
  ),
);

/** Every community charger visible in the app: demo listings plus the user's own. */
export function useCommunityChargers(includePaused = false): CommunityCharger[] {
  const hosted = useCommunityStore((s) => s.hosted);
  const all = [...hosted, ...DEMO_COMMUNITY_CHARGERS];
  return includePaused ? all : all.filter((c) => !c.paused);
}

export function communityChargerById(id: string): CommunityCharger | undefined {
  return useCommunityStore.getState().hosted.find((c) => c.id === id) ?? DEMO_COMMUNITY_CHARGERS.find((c) => c.id === id);
}

export function useUnreadCount(): number {
  return useCommunityStore((s) => s.messages.filter((m) => m.from !== 'me' && m.at > (s.lastReadAt[m.conversationId] ?? 0)).length);
}
