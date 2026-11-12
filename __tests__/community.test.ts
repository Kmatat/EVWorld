import {
  approximateLocation,
  canSeePrivateDetails,
  CommunityCharger,
  describeAvailability,
  estimateHostEarnings,
  isAvailableAt,
  measureSessionKwh,
  nextBookingActions,
  quoteSession,
  suggestHostPrice,
  visibleLocation,
} from '@/core/community';
import { haversineKm } from '@/core/geo';

const charger: CommunityCharger = {
  id: 'cc-test',
  hostId: 'u1',
  hostName: 'Mona S.',
  hostRating: 4.9,
  hostSessions: 12,
  hostPhoneVerified: true,
  title: 'Villa wallbox',
  plug: 'type2_tethered',
  powerKw: 7.4,
  pricePerKwh: 3,
  area: 'Sheikh Zayed',
  city: 'Giza',
  location: { lat: 30.044, lng: 30.983 },
  showApproximate: true,
  availability: { days: [0, 1, 2, 3, 4], from: '18:00', to: '02:00' },
  parking: 'villa_driveway',
  accessInstructions: 'Gate 2',
  description: '',
  paused: false,
  createdAt: 0,
};

describe('community charging pricing', () => {
  it('adds a service fee for the driver and pays the host the energy amount', () => {
    const q = quoteSession(20, 3);
    expect(q.energyCost).toBe(60);
    expect(q.serviceFee).toBe(6);
    expect(q.total).toBe(66);
    expect(q.hostEarnings).toBe(60);
  });

  it('applies a minimum fee on small sessions and nothing for zero kWh', () => {
    expect(quoteSession(2, 3).serviceFee).toBe(5);
    expect(quoteSession(0, 3).total).toBe(0);
  });

  it('suggests a host price above their own electricity cost', () => {
    const s = suggestHostPrice(2.2);
    expect(s.low).toBeGreaterThan(2.2);
    expect(s.suggested).toBeGreaterThan(s.low);
    expect(s.high).toBeGreaterThan(s.suggested);
    expect(estimateHostEarnings(3, 2.2, 3).profit).toBeGreaterThan(0);
  });
});

describe('measuring kWh', () => {
  it('uses meter readings and rejects impossible values', () => {
    expect(measureSessionKwh({ method: 'meter', startReading: 1000.5, endReading: 1022.75 })).toEqual({ kWh: 22.25 });
    expect(measureSessionKwh({ method: 'meter', startReading: 50, endReading: 40 }).error).toBeDefined();
    expect(measureSessionKwh({ method: 'meter', startReading: 0, endReading: 500 }).error).toBeDefined();
  });

  it('estimates from time, limited by the car on-board charger', () => {
    // 22 kW wallbox but the car accepts 7 kW: 2 h × 7 kW × 90% = 12.6 kWh
    expect(measureSessionKwh({ method: 'timer', minutes: 120, chargerKw: 22, carMaxAcKw: 7 }).kWh).toBe(12.6);
  });
});

describe('location privacy', () => {
  it('shows a stable approximate point 250–450 m away until a request is accepted', () => {
    const a = approximateLocation(charger.location, charger.id);
    const b = approximateLocation(charger.location, charger.id);
    expect(a).toEqual(b);
    const m = haversineKm(a, charger.location) * 1000;
    expect(m).toBeGreaterThanOrEqual(240);
    expect(m).toBeLessThanOrEqual(460);
    expect(visibleLocation(charger, false, false).exact).toBe(false);
    expect(visibleLocation(charger, true, false)).toEqual({ location: charger.location, exact: true });
    expect(visibleLocation(charger, false, true).exact).toBe(true);
    expect(visibleLocation({ ...charger, showApproximate: false }, false, false).exact).toBe(true);
  });
});

describe('availability and booking flow', () => {
  it('handles overnight windows', () => {
    // Sunday 20:00 → open; Monday 01:00 (Sunday's window) → open; Friday 20:00 → closed.
    expect(isAvailableAt(charger.availability, new Date(2026, 10, 15, 20, 0))).toBe(true);
    expect(isAvailableAt(charger.availability, new Date(2026, 10, 16, 1, 0))).toBe(true);
    expect(isAvailableAt(charger.availability, new Date(2026, 10, 20, 20, 0))).toBe(false);
    expect(isAvailableAt(charger.availability, new Date(2026, 10, 15, 12, 0))).toBe(false);
    expect(describeAvailability(charger.availability)).toBe('Sun–Thu, 18:00–02:00');
  });

  it('only allows valid next steps for each side', () => {
    expect(nextBookingActions('requested', 'host')).toEqual(['accepted', 'declined']);
    expect(nextBookingActions('requested', 'driver')).toEqual(['cancelled']);
    expect(nextBookingActions('accepted', 'driver')).toContain('charging');
    expect(nextBookingActions('charging', 'driver')).toEqual(['completed']);
    expect(nextBookingActions('completed', 'host')).toEqual([]);
    expect(canSeePrivateDetails('requested')).toBe(false);
    expect(canSeePrivateDetails('accepted')).toBe(true);
  });
});
