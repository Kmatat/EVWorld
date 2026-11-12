import { LatLng } from './types';

/**
 * USER IDENTITY: MOBILE NUMBERS & DELIVERY ADDRESSES (EGYPT)
 * ==========================================================
 * Every account must have a verified Egyptian mobile number:
 *  - sellers, hosts and couriers need a reachable buyer,
 *  - one-number-one-account makes fraud and fake reviews harder,
 *  - it lets us send OTP codes and WhatsApp / SMS updates.
 * The number is never shown to other users. Chats go through EVWorld.
 */

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9. */
export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));
}

/**
 * Egyptian mobile numbers: 01X XXXX XXXX, where X (the operator prefix) is
 * 0, 1, 2 or 5 (Vodafone, Etisalat/e&, Orange, WE). Returns "+201XXXXXXXXX" or null.
 */
export function normalizeEgyptMobile(input: string): string | null {
  let digits = toLatinDigits(input).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = '0' + digits;
  if (!/^01[0125]\d{8}$/.test(digits)) return null;
  return '+2' + digits;
}

export const isValidEgyptMobile = (input: string) => normalizeEgyptMobile(input) !== null;

/** "+201012345678" → "+20 101 234 5678" */
export function formatEgyptMobile(normalized: string): string {
  const m = normalized.match(/^\+20(\d{3})(\d{3})(\d{4})$/);
  return m ? `+20 ${m[1]} ${m[2]} ${m[3]}` : normalized;
}

/** For the user's own screens: "+20 10• ••• ••78". */
export function maskPhone(normalized: string): string {
  const m = normalized.match(/^\+20(\d{2})\d{6}(\d{2})$/);
  return m ? `+20 ${m[1]}• ••• ••${m[2]}` : '••••';
}

/** Public name shown to other users: first name + last initial ("Karim M."). */
export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EVWorld user';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia', 'Beheira',
  'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'North Sinai', 'South Sinai', 'Red Sea',
  'Matrouh', 'Faiyum', 'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'New Valley',
] as const;

export type Governorate = (typeof GOVERNORATES)[number];

export interface Address {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  governorate: Governorate | '';
  city: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  /** Egyptian deliveries rely heavily on landmarks ("behind City Stars, next to the pharmacy"). */
  landmark?: string;
  location?: LatLng;
  isDefault?: boolean;
}

export type AddressErrors = Partial<Record<keyof Address, string>>;

export function validateAddress(a: Partial<Address>): AddressErrors {
  const errors: AddressErrors = {};
  if (!a.governorate) errors.governorate = 'Choose a governorate';
  if (!a.city?.trim()) errors.city = 'Enter the city or area';
  if (!a.street?.trim() || a.street.trim().length < 3) errors.street = 'Enter the street name';
  if (!a.building?.trim()) errors.building = 'Enter the building number or name';
  return errors;
}

export function formatAddress(a: Address): string {
  const unit = [a.building && `Bldg ${a.building}`, a.floor && `Floor ${a.floor}`, a.apartment && `Apt ${a.apartment}`]
    .filter(Boolean)
    .join(', ');
  return [unit, a.street, a.city, a.governorate].filter(Boolean).join(', ') + (a.landmark ? ` (near ${a.landmark})` : '');
}
