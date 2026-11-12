export const colors = {
  primary: '#0E9F6E',
  primaryDark: '#057A55',
  primarySoft: '#DEF7EC',
  ink: '#111827',
  inkSoft: '#4B5563',
  muted: '#6B7280',
  faint: '#9CA3AF',
  bg: '#F3F5F7',
  card: '#FFFFFF',
  border: '#E5E7EB',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  blue: '#2563EB',
  blueSoft: '#DBEAFE',
  purple: '#7C3AED',
  purpleSoft: '#EDE9FE',
  map: {
    sea: '#D6E9F5',
    land: '#F7F4EC',
    landStroke: '#D9D2BF',
    nile: '#8EC5E8',
    road: '#C9C2AE',
  },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

/** Green when healthy, amber when getting low, red when critical. */
export function batteryColor(percent: number): string {
  if (percent < 15) return colors.red;
  if (percent < 35) return colors.amber;
  return colors.primary;
}
