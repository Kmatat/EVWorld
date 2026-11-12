import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import { BatterySourceKind } from '@/core/liveBattery';
import { IconName } from '@/components/ui';

/**
 * WHERE THE BATTERY % COMES FROM
 * ==============================
 * The app accepts car data from several "links". Whatever the link, the
 * rest of the app receives the same signal: battery %, AC on/off, speed.
 *
 * | Link                     | Battery | AC | Speed | Where it works |
 * |--------------------------|---------|----|-------|----------------|
 * | Android Auto             | ✓ (car-dependent) | – | ✓ | Android phones in cars that share energy data |
 * | Android Automotive (built-in Google cars) | ✓ | ✓ | ✓ | Volvo, Polestar, Renault and others |
 * | Connected-car account (Enode / Smartcar) | ✓ | some brands | – | iPhone & Android; BYD, MG, Tesla, Hyundai/Kia, BMW, VW… |
 * | Bluetooth OBD-II dongle  | ✓ | some | ✓ | Most cars, incl. Chinese brands without a cloud API |
 * | Apple CarPlay            | ✗       | ✗  | ✗     | Apple does not give apps car data through CarPlay |
 * | Manual                   | driver enters it | | | Always |
 */

export type VehicleLinkId = 'manual' | 'android_auto' | 'cloud' | 'obd' | 'demo';

export interface VehicleSignal {
  batteryPercent?: number;
  climateOn?: boolean;
  speedKmh?: number;
  at: number;
  source: BatterySourceKind;
}

export interface VehicleLinkInfo {
  id: VehicleLinkId;
  title: string;
  icon: IconName;
  body: string;
  gives: string;
  /** Can be switched on in this build. */
  availableNow: boolean;
  status: string;
}

/** Native module the Android Auto car service publishes (see docs/CAR_INTEGRATION.md). */
const nativeCar = NativeModules.EVWorldCarData as { start?: () => void; stop?: () => void } | undefined;

export function isAndroidAutoBridgeAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeCar?.start;
}

export const VEHICLE_LINKS: VehicleLinkInfo[] = [
  {
    id: 'android_auto',
    title: 'Android Auto',
    icon: 'logo-android',
    body: 'When your Android phone is connected to the car, EVWorld reads the battery % and speed the car shares with Android Auto, and shows chargers on the car screen.',
    gives: 'Battery %, range, speed',
    availableNow: isAndroidAutoBridgeAvailable(),
    status: isAndroidAutoBridgeAvailable() ? 'Ready' : 'Needs the Android app build with the car module',
  },
  {
    id: 'cloud',
    title: 'Connected-car account',
    icon: 'cloud-outline',
    body: "Log in with your car brand's app account (BYD, MG, Tesla, Hyundai, Kia, BMW, Mercedes, VW…) through a car-data provider. Works on iPhone and Android, even without CarPlay or Android Auto.",
    gives: 'Battery %, charging status, AC (some brands)',
    availableNow: false,
    status: 'Needs a provider contract (Enode or Smartcar) and the EVWorld server',
  },
  {
    id: 'obd',
    title: 'Bluetooth OBD-II dongle',
    icon: 'bluetooth-outline',
    body: 'A small plug under the dashboard reads the battery directly. The best option for cars without a cloud API, including many grey-import Chinese models.',
    gives: 'Battery %, speed, AC (some cars)',
    availableNow: false,
    status: 'Planned: pilot with a dongle sold in the Market',
  },
  {
    id: 'demo',
    title: 'Demo car (simulated)',
    icon: 'game-controller-outline',
    body: 'A simulated connected car that reports its battery while you "drive" in trip mode, so you can see live updates and learning without a real car.',
    gives: 'Battery %, AC, speed',
    availableNow: true,
    status: 'Try it now',
  },
  {
    id: 'manual',
    title: 'Enter it myself',
    icon: 'create-outline',
    body: 'Set the battery % before you leave. During the trip EVWorld estimates it from the distance driven, and you can correct it any time.',
    gives: 'Estimated battery %',
    availableNow: true,
    status: 'Always available',
  },
];

export function linkLabel(id: VehicleLinkId): string {
  switch (id) {
    case 'android_auto':
      return 'from car (Android Auto)';
    case 'cloud':
      return 'from car account';
    case 'obd':
      return 'from OBD dongle';
    case 'demo':
      return 'from demo car';
    default:
      return 'estimated';
  }
}

/**
 * Subscribes to the Android Auto native bridge. Returns an unsubscribe
 * function, or undefined when the bridge isn't in this build.
 */
export function subscribeAndroidAuto(onSignal: (s: VehicleSignal) => void): (() => void) | undefined {
  if (!isAndroidAutoBridgeAvailable()) return undefined;
  const emitter = new NativeEventEmitter(NativeModules.EVWorldCarData);
  const sub = emitter.addListener('energyLevel', (e: { batteryPercent?: number; speedKmh?: number }) =>
    onSignal({ batteryPercent: e.batteryPercent, speedKmh: e.speedKmh, at: Date.now(), source: 'car' }),
  );
  nativeCar!.start!();
  return () => {
    sub.remove();
    nativeCar?.stop?.();
  };
}
