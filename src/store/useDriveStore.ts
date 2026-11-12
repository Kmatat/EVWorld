import { create } from 'zustand';

import { analyzeDrivingStyle, SpeedSample } from '@/core/autoConditions';
import { haversineKm } from '@/core/geo';
import { addDistance, applyReading, currentPercent, LiveBatteryState, shouldReplan, startLiveBattery, updateConsumptionFactor } from '@/core/liveBattery';
import { clampFactor, consumption } from '@/core/range';
import { routeShapeThrough } from '@/core/roads';
import { planTrip, TripPlan } from '@/core/tripPlanner';
import { LatLng } from '@/core/types';
import { STATIONS } from '@/data/stations';
import type { VehicleSignal } from '@/services/vehicleData';

import { getCurrentVehicle, useAppStore } from './useAppStore';

/**
 * TRIP MODE
 * =========
 * While you drive, this keeps the battery %, remaining range and charging
 * plan up to date:
 *  - distance comes from GPS (or the demo simulator),
 *  - battery readings come from the car link (Android Auto, car account,
 *    OBD dongle or the demo car),
 *  - between readings the battery is estimated from distance,
 *  - the plan is recalculated when the battery drifts 3%+ from what the plan
 *    expected, every 25 km, or every 15 minutes (charger status changes).
 * At the end of the drive, the learned consumption and detected driving
 * style are saved for future plans.
 */

interface Place {
  name: string;
  location: LatLng;
}

interface DriveEvent {
  at: number;
  text: string;
}

interface DriveState {
  active: boolean;
  finished: boolean;
  origin?: Place;
  destination?: Place;
  plan?: TripPlan;
  route: LatLng[];
  routeKm: number;
  legKm: number;
  tripKm: number;
  position?: LatLng;
  live?: LiveBatteryState;
  /** Model consumption for the current conditions, before personal learning. */
  modelWhPerKm: number;
  planBaseline: { percent: number; tripKm: number; clock: number };
  chargedAt: string[];
  events: DriveEvent[];
  climateOn?: boolean;
  lastSignalAt?: number;
  /** Seconds of driving (real or simulated). */
  clock: number;
  samples: SpeedSample[];
  simulating: boolean;
  speedup: number;
  /** Demo only: the "true" battery of the simulated car (it uses a bit more than predicted). */
  simTruePercent: number;
  lastSimSignalClock: number;

  start: (args: { origin: Place; destination: Place; batteryPercent: number }) => void;
  stop: () => void;
  setSimulating: (on: boolean) => void;
  setSpeedup: (x: number) => void;
  tick: (realSeconds: number) => void;
  gpsUpdate: (pos: LatLng, speedKmh: number | undefined, at: number) => void;
  signal: (s: VehicleSignal) => void;
  correct: (percent: number) => void;
  replan: (reason: string) => void;
}

/** How much more the demo car really uses than the model predicts (so learning is visible). */
const DEMO_REAL_FACTOR = 1.08;

function pointAlong(route: LatLng[], fraction: number): LatLng {
  if (route.length === 0) return { lat: 0, lng: 0 };
  if (route.length === 1 || fraction <= 0) return route[0];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = haversineKm(route[i - 1], route[i]);
    seg.push(d);
    total += d;
  }
  let target = Math.min(1, fraction) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const f = seg[i] === 0 ? 0 : Math.min(1, target / seg[i]);
      const a = route[i];
      const b = route[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    target -= seg[i];
  }
  return route[route.length - 1];
}

const idle = {
  active: false,
  finished: false,
  origin: undefined,
  destination: undefined,
  plan: undefined,
  route: [] as LatLng[],
  routeKm: 0,
  legKm: 0,
  tripKm: 0,
  position: undefined,
  live: undefined,
  modelWhPerKm: 0,
  planBaseline: { percent: 0, tripKm: 0, clock: 0 },
  chargedAt: [] as string[],
  events: [] as DriveEvent[],
  climateOn: undefined,
  lastSignalAt: undefined,
  clock: 0,
  samples: [] as SpeedSample[],
  simulating: false,
  speedup: 60,
  simTruePercent: 0,
  lastSimSignalClock: 0,
};

export const useDriveStore = create<DriveState>()((set, get) => {
  const log = (text: string) => set({ events: [{ at: Date.now(), text }, ...get().events].slice(0, 12) });

  /** Personal factor: what this drive has learned so far, else what earlier drives taught us. */
  const currentFactor = () => {
    const { live, modelWhPerKm } = get();
    if (live?.learnedWhPerKm && modelWhPerKm) return clampFactor(live.learnedWhPerKm / modelWhPerKm);
    return useAppStore.getState().consumptionFactor[getCurrentVehicle().id] ?? 1;
  };

  const advance = (km: number, speedKmh: number, dtSeconds: number) => {
    const s = get();
    if (!s.live) return;
    const legKm = s.legKm + km;
    set({
      legKm,
      tripKm: s.tripKm + km,
      clock: s.clock + dtSeconds,
      live: addDistance(s.live, km),
      position: s.routeKm > 0 ? pointAlong(s.route, legKm / s.routeKm) : s.position,
      samples: [...s.samples, { t: s.clock + dtSeconds, speedKmh }].slice(-3000),
    });
  };

  /** Keeps the battery % shown everywhere else in the app in sync with the trip. */
  const syncAppBattery = () => {
    const s = get();
    if (!s.live) return;
    const pct = Math.round(currentPercent(s.live, getCurrentVehicle()));
    if (pct !== useAppStore.getState().batteryPercent) useAppStore.getState().setBattery(pct);
  };

  const afterMove = () => {
    syncAppBattery();
    const s = get();
    if (!s.live || !s.plan) return;
    const vehicle = getCurrentVehicle();

    // Reached a planned charging stop: charge to the planned level.
    const stop = s.plan.stops.find((x) => !s.chargedAt.includes(x.station.id) && s.legKm >= x.distanceFromStartKm);
    if (stop) {
      const live = applyReading(s.live, { percent: stop.departurePercent, at: Date.now(), source: 'manual' }, vehicle);
      set({
        live,
        chargedAt: [...s.chargedAt, stop.station.id],
        simTruePercent: Math.max(s.simTruePercent, stop.departurePercent),
        planBaseline: { percent: stop.departurePercent, tripKm: s.tripKm, clock: s.clock },
      });
      log(`Charged at ${stop.station.name}: ${Math.round(stop.arrivalPercent)}% → ${Math.round(stop.departurePercent)}%`);
      return;
    }

    // Arrived.
    if (s.plan.status !== 'unreachable' && s.legKm >= s.routeKm - 0.05) {
      const pct = currentPercent(s.live, vehicle);
      set({ finished: true, simulating: false, position: s.destination?.location });
      log(`Arrived at ${s.destination?.name} with ${Math.round(pct)}%`);
      saveLearning();
      return;
    }

    // Drifted from the plan, or time to refresh charger status?
    const expected = s.planBaseline.percent - ((s.tripKm - s.planBaseline.tripKm) * s.plan.whPerKm) / 1000 / vehicle.usableKwh * 100;
    const actual = currentPercent(s.live, vehicle);
    if (shouldReplan({ expectedPercent: expected, actualPercent: actual, kmSinceLastPlan: s.tripKm - s.planBaseline.tripKm, minutesSinceLastPlan: (s.clock - s.planBaseline.clock) / 60 })) {
      const drift = actual - expected;
      get().replan(Math.abs(drift) >= 3 ? `battery is ${Math.abs(Math.round(drift))}% ${drift < 0 ? 'lower' : 'higher'} than planned` : 'refreshing charger status');
    }
  };

  const saveLearning = () => {
    const s = get();
    const app = useAppStore.getState();
    const vehicle = getCurrentVehicle();
    if (s.live) {
      const factor = updateConsumptionFactor(app.consumptionFactor[vehicle.id], s.live, s.modelWhPerKm);
      if (factor != null) app.setConsumptionFactor(vehicle.id, clampFactor(factor));
    }
    const style = analyzeDrivingStyle(s.samples);
    if (style) app.setDetectedStyle(style.style);
  };

  return {
    ...idle,

    start: ({ origin, destination, batteryPercent }) => {
      const app = useAppStore.getState();
      const vehicle = getCurrentVehicle();
      const modelWhPerKm = consumption(vehicle, app.conditions).totalWhPerKm;
      const factor = app.consumptionFactor[vehicle.id] ?? 1;
      const source = app.vehicleLink === 'manual' ? 'manual' : 'car';
      set({
        ...idle,
        active: true,
        origin,
        destination,
        position: origin.location,
        modelWhPerKm,
        live: startLiveBattery(batteryPercent, modelWhPerKm * factor, source),
        simTruePercent: batteryPercent,
        climateOn: app.conditions.climateOn,
        speedup: get().speedup,
      });
      log(`Trip started with ${Math.round(batteryPercent)}%`);
      get().replan('trip start');
    },

    stop: () => {
      if (get().active && !get().finished) saveLearning();
      set({ ...idle, speedup: get().speedup });
    },

    setSimulating: (simulating) => set({ simulating }),
    setSpeedup: (speedup) => set({ speedup }),

    replan: (reason) => {
      const s = get();
      if (!s.live || !s.destination || !s.position) return;
      const app = useAppStore.getState();
      const vehicle = getCurrentVehicle();
      const battery = currentPercent(s.live, vehicle);
      const factor = currentFactor();
      const plan = planTrip({
        vehicle,
        batteryPercent: battery,
        origin: s.position,
        destination: s.destination.location,
        conditions: app.conditions,
        stations: STATIONS,
        reservePercent: app.reservePercent,
        consumptionFactor: factor,
        now: Date.now(),
      });
      set({
        plan,
        route: routeShapeThrough(plan.path),
        routeKm: plan.totalKm,
        legKm: 0,
        chargedAt: [],
        planBaseline: { percent: battery, tripKm: s.tripKm, clock: s.clock },
        live: s.live.learnedWhPerKm ? s.live : { ...s.live, whPerKm: plan.whPerKm },
      });
      if (reason !== 'trip start') log(`Plan updated: ${reason}`);
    },

    tick: (realSeconds) => {
      const s = get();
      if (!s.active || !s.simulating || s.finished || !s.plan || !s.live) return;
      const app = useAppStore.getState();
      const vehicle = getCurrentVehicle();
      const dt = realSeconds * s.speedup;
      const t = s.clock + dt;
      const base = app.conditions.profile === 'city' ? 38 : app.conditions.profile === 'mixed' ? 68 : 104;
      const speed = Math.max(15, base + 14 * Math.sin(t / 95) + 6 * Math.sin(t / 23));
      const km = Math.min((speed * dt) / 3600, Math.max(0.01, s.routeKm - s.legKm));
      advance(km, speed, dt);

      // The simulated car's real battery, slightly worse than predicted.
      const trueUse = ((km * s.modelWhPerKm * DEMO_REAL_FACTOR) / 1000 / vehicle.usableKwh) * 100;
      set({ simTruePercent: Math.max(0, get().simTruePercent - trueUse) });

      // The demo car reports its battery every 2 minutes of driving.
      if (app.vehicleLink === 'demo' && get().clock - get().lastSimSignalClock >= 120) {
        set({ lastSimSignalClock: get().clock });
        get().signal({ batteryPercent: Math.round(get().simTruePercent), climateOn: app.conditions.temperatureC >= 26, speedKmh: speed, at: Date.now(), source: 'car' });
      }
      afterMove();
    },

    gpsUpdate: (pos, speedKmh, at) => {
      const s = get();
      if (!s.active || s.simulating || s.finished || !s.live) return;
      const prev = s.position;
      const km = prev ? haversineKm(prev, pos) : 0;
      if (km < 0.01 || km > 5) {
        set({ position: pos });
        return;
      }
      const dt = s.lastSignalAt ? Math.max(1, (at - s.lastSignalAt) / 1000) : 5;
      advance(km, speedKmh ?? (km / dt) * 3600, dt);
      set({ position: pos, lastSignalAt: at });
      afterMove();
    },

    signal: (sig) => {
      const s = get();
      if (!s.live) return;
      const vehicle = getCurrentVehicle();
      if (sig.batteryPercent != null) {
        const before = Math.round(currentPercent(s.live, vehicle));
        const live = applyReading(s.live, { percent: sig.batteryPercent, at: sig.at, source: sig.source }, vehicle);
        set({ live, lastSignalAt: sig.at });
        syncAppBattery();
        if (Math.round(sig.batteryPercent) !== before) log(`Battery from car: ${Math.round(sig.batteryPercent)}% (estimate was ${before}%)`);
      }
      if (sig.climateOn != null && sig.climateOn !== s.climateOn) {
        set({ climateOn: sig.climateOn });
        const app = useAppStore.getState();
        if (app.autoConditions) app.setConditions({ climateOn: sig.climateOn });
        log(`Car reports AC ${sig.climateOn ? 'on' : 'off'}`);
      }
    },

    correct: (percent) => {
      const s = get();
      if (!s.live) return;
      set({ live: applyReading(s.live, { percent, at: Date.now(), source: 'manual' }, getCurrentVehicle()), simTruePercent: percent });
      syncAppBattery();
      log(`Battery corrected to ${percent}%`);
      get().replan('battery corrected');
    },
  };
});
