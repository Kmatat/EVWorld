import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Address } from '@/core/identity';
import { AuthProvider } from '@/services/auth';

import { safeStorage } from './safeStorage';

export interface UserProfile {
  id: string;
  provider: AuthProvider;
  name: string;
  email?: string;
  /** Normalized +20… number. Private: never shown to other users. */
  phone?: string;
  phoneVerified: boolean;
  createdAt: number;
}

interface AuthState {
  user?: UserProfile;
  addresses: Address[];
  signIn: (u: Omit<UserProfile, 'phoneVerified' | 'createdAt'>) => void;
  completeProfile: (p: { name: string; phone: string }) => void;
  signOut: () => void;
  saveAddress: (a: Address) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: undefined,
      addresses: [],
      signIn: (u) => {
        const existing = get().user;
        // Same account signing in again keeps its verified phone.
        if (existing && existing.id === u.id) return;
        set({ user: { ...u, phoneVerified: false, createdAt: Date.now() } });
      },
      completeProfile: ({ name, phone }) => {
        const user = get().user;
        if (user) set({ user: { ...user, name, phone, phoneVerified: true } });
      },
      signOut: () => set({ user: undefined }),
      saveAddress: (a) => {
        let list = get().addresses.filter((x) => x.id !== a.id);
        const makeDefault = a.isDefault || list.length === 0;
        if (makeDefault) list = list.map((x) => ({ ...x, isDefault: false }));
        set({ addresses: [...list, { ...a, isDefault: makeDefault }] });
      },
      removeAddress: (id) => {
        const list = get().addresses.filter((x) => x.id !== id);
        if (list.length && !list.some((x) => x.isDefault)) list[0] = { ...list[0], isDefault: true };
        set({ addresses: list });
      },
      setDefaultAddress: (id) => set({ addresses: get().addresses.map((x) => ({ ...x, isDefault: x.id === id })) }),
    }),
    { name: 'evworld-auth-v1', storage: createJSONStorage(() => safeStorage) },
  ),
);

/** Signed in AND has a verified mobile: allowed to order, chat, book and host. */
export const useAccountReady = () => useAuthStore((s) => !!s.user?.phoneVerified);

export const useDefaultAddress = () => useAuthStore((s) => s.addresses.find((a) => a.isDefault) ?? s.addresses[0]);
