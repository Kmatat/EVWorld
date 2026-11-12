import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';

import { CartLine, PaymentMethod } from '@/core/marketplace';
import { DEFAULT_CONDITIONS, DEFAULT_RESERVE_PERCENT } from '@/core/range';
import { DrivingConditions, Vehicle } from '@/core/types';
import { DEFAULT_VEHICLE_ID, VEHICLES } from '@/data/vehicles';

/**
 * App state that survives restarts: the driver's car, battery level, trip
 * settings, basket and activity. In production most of this also syncs to
 * the user's account on the server.
 */

export type BatterySource = 'manual' | 'connected';

export interface PlacedOrder {
  id: string;
  vendorId: string;
  items: { productId: string; quantity: number }[];
  total: number;
  payment: PaymentMethod;
  createdAt: number;
  status: 'placed' | 'shipped' | 'delivered';
}

export interface Booking {
  id: string;
  shopId: string;
  service: string;
  date: string;
  time: string;
  createdAt: number;
}

export interface CarInquiry {
  id: string;
  carId: string;
  kind: 'message' | 'offer' | 'inspection';
  offerEgp?: number;
  createdAt: number;
}

export interface StationReport {
  stationId: string;
  issue: string;
  createdAt: number;
}

export interface SellerApplication {
  id: string;
  kind: 'business' | 'car';
  title: string;
  plan?: string;
  createdAt: number;
}

interface AppState {
  vehicleId: string;
  customVehicle?: Vehicle;
  batteryPercent: number;
  batterySource: BatterySource;
  reservePercent: number;
  conditions: DrivingConditions;
  originPlaceId: string | 'gps';
  destinationPlaceId?: string;
  stationFilters: { compatibleOnly: boolean; dcOnly: boolean; availableOnly: boolean; fastOnly: boolean };
  watchedStations: string[];
  reports: StationReport[];
  cart: CartLine[];
  orders: PlacedOrder[];
  bookings: Booking[];
  inquiries: CarInquiry[];
  savedCars: string[];
  applications: SellerApplication[];

  setVehicle: (id: string) => void;
  setCustomVehicle: (v: Vehicle) => void;
  setBattery: (percent: number) => void;
  setReserve: (percent: number) => void;
  setConditions: (c: Partial<DrivingConditions>) => void;
  setOrigin: (id: string | 'gps') => void;
  setDestination: (id: string | undefined) => void;
  toggleStationFilter: (key: keyof AppState['stationFilters']) => void;
  toggleWatch: (stationId: string) => void;
  addReport: (r: Omit<StationReport, 'createdAt'>) => void;
  addToCart: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  addOrders: (orders: PlacedOrder[]) => void;
  addBooking: (b: Omit<Booking, 'id' | 'createdAt'>) => Booking;
  addInquiry: (i: Omit<CarInquiry, 'id' | 'createdAt'>) => void;
  toggleSavedCar: (carId: string) => void;
  addApplication: (a: Omit<SellerApplication, 'id' | 'createdAt'>) => void;
}

/** Storage that never crashes the app (e.g. private browsing blocks localStorage). */
const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

let counter = 1040;
export const newId = (prefix: string) => `${prefix}-${++counter}${Math.floor(Math.random() * 10)}`;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      vehicleId: DEFAULT_VEHICLE_ID,
      customVehicle: undefined,
      batteryPercent: 64,
      batterySource: 'manual',
      reservePercent: DEFAULT_RESERVE_PERCENT,
      conditions: DEFAULT_CONDITIONS,
      originPlaceId: 'downtown',
      destinationPlaceId: 'alamein',
      stationFilters: { compatibleOnly: true, dcOnly: false, availableOnly: false, fastOnly: false },
      watchedStations: [],
      reports: [],
      cart: [],
      orders: [],
      bookings: [],
      inquiries: [],
      savedCars: [],
      applications: [],

      setVehicle: (vehicleId) => set({ vehicleId }),
      setCustomVehicle: (customVehicle) => set({ customVehicle, vehicleId: customVehicle.id }),
      setBattery: (batteryPercent) => set({ batteryPercent: Math.round(Math.min(100, Math.max(0, batteryPercent))) }),
      setReserve: (reservePercent) => set({ reservePercent }),
      setConditions: (c) => set({ conditions: { ...get().conditions, ...c } }),
      setOrigin: (originPlaceId) => set({ originPlaceId }),
      setDestination: (destinationPlaceId) => set({ destinationPlaceId }),
      toggleStationFilter: (key) => set({ stationFilters: { ...get().stationFilters, [key]: !get().stationFilters[key] } }),
      toggleWatch: (id) => {
        const w = get().watchedStations;
        set({ watchedStations: w.includes(id) ? w.filter((x) => x !== id) : [...w, id] });
      },
      addReport: (r) => set({ reports: [{ ...r, createdAt: Date.now() }, ...get().reports] }),
      addToCart: (productId, quantity = 1) => {
        const cart = get().cart;
        const line = cart.find((l) => l.productId === productId);
        set({
          cart: line
            ? cart.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l))
            : [...cart, { productId, quantity }],
        });
      },
      setQuantity: (productId, quantity) =>
        set({
          cart:
            quantity <= 0
              ? get().cart.filter((l) => l.productId !== productId)
              : get().cart.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
        }),
      clearCart: () => set({ cart: [] }),
      addOrders: (orders) => set({ orders: [...orders, ...get().orders] }),
      addBooking: (b) => {
        const booking = { ...b, id: newId('BK'), createdAt: Date.now() };
        set({ bookings: [booking, ...get().bookings] });
        return booking;
      },
      addInquiry: (i) => set({ inquiries: [{ ...i, id: newId('IQ'), createdAt: Date.now() }, ...get().inquiries] }),
      toggleSavedCar: (id) => {
        const s = get().savedCars;
        set({ savedCars: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] });
      },
      addApplication: (a) => set({ applications: [{ ...a, id: newId('AP'), createdAt: Date.now() }, ...get().applications] }),
    }),
    {
      name: 'evworld-state-v1',
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);

/** The car currently selected, including a custom one. */
export function useVehicle(): Vehicle {
  const vehicleId = useAppStore((s) => s.vehicleId);
  const custom = useAppStore((s) => s.customVehicle);
  if (custom && custom.id === vehicleId) return custom;
  return VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0];
}

export const useCartCount = () => useAppStore((s) => s.cart.reduce((n, l) => n + l.quantity, 0));
