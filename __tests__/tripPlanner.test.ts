import { isCompatible } from '@/core/charging';
import { planTrip, TripInput } from '@/core/tripPlanner';
import { DrivingConditions } from '@/core/types';
import { PLACES, placeById } from '@/data/places';
import { STATIONS } from '@/data/stations';
import { VEHICLES, vehicleById } from '@/data/vehicles';

const NOW = Date.UTC(2026, 10, 12, 9, 0, 0);
const highway: DrivingConditions = { profile: 'highway', temperatureC: 32, climateOn: true, style: 'normal', passengers: 2 };
const loc = (id: string) => placeById(id)!.location;

const base = (over: Partial<TripInput>): TripInput => ({
  vehicle: vehicleById('byd-atto3')!,
  batteryPercent: 80,
  origin: loc('new-cairo'),
  destination: loc('downtown'),
  conditions: highway,
  stations: STATIONS,
  now: NOW,
  ...over,
});

describe('trip planner', () => {
  it('needs no charging stop for a short city trip', () => {
    const plan = planTrip(base({ conditions: { ...highway, profile: 'city' } }));
    expect(plan.status).toBe('direct');
    expect(plan.stops).toHaveLength(0);
    expect(plan.arrivalPercent).toBeGreaterThan(60);
    expect(plan.nearOrigin.length).toBeGreaterThan(0);
    expect(plan.nearDestination.length).toBeGreaterThan(0);
  });

  it('plans charging stops from New Cairo to Hurghada with a 60% battery', () => {
    const plan = planTrip(base({ batteryPercent: 60, destination: loc('hurghada') }));
    expect(plan.status).toBe('with_stops');
    expect(plan.stops.length).toBeGreaterThanOrEqual(1);
    expect(plan.arrivalPercent).toBeGreaterThanOrEqual(plan.reservePercent);
    for (const stop of plan.stops) {
      expect(stop.arrivalPercent).toBeGreaterThanOrEqual(plan.reservePercent);
      expect(stop.departurePercent).toBeGreaterThan(stop.arrivalPercent);
      expect(stop.departurePercent).toBeLessThanOrEqual(100);
      expect(stop.chargeMinutes).toBeGreaterThan(0);
    }
    expect(plan.totalMinutes).toBeCloseTo(plan.driveMinutes + plan.chargeMinutes + plan.stopOverheadMinutes, 5);
    expect(plan.stopOverheadMinutes).toBeGreaterThanOrEqual(8 * plan.stops.length);
    expect(plan.chargeCostEgp).toBeGreaterThan(0);
    expect(plan.path[0]).toEqual(loc('new-cairo'));
    expect(plan.path[plan.path.length - 1]).toEqual(loc('hurghada'));
  });

  it('recalculates when the battery changes: more charge means fewer or shorter stops', () => {
    const low = planTrip(base({ batteryPercent: 30, destination: loc('alamein') }));
    const high = planTrip(base({ batteryPercent: 100, destination: loc('alamein') }));
    expect(high.stops.length).toBeLessThanOrEqual(low.stops.length);
    expect(high.chargeMinutes).toBeLessThan(low.chargeMinutes);
  });

  it('prefers one well-placed stop over two stops close together', () => {
    const plan = planTrip(base({ batteryPercent: 40, origin: loc('downtown'), destination: loc('alamein') }));
    expect(plan.status).toBe('with_stops');
    expect(plan.stops).toHaveLength(1);
  });

  it('charges near the start first when the battery is too low to go anywhere else', () => {
    const plan = planTrip(base({ batteryPercent: 12, origin: loc('zayed'), destination: loc('alex') }));
    expect(plan.status).toBe('with_stops');
    expect(plan.stops[0].legKm).toBeLessThan(25);
  });

  it('shows how far you can get when the network has a gap', () => {
    const onlyCairo = STATIONS.filter((s) => s.region === 'Cairo');
    const plan = planTrip(base({ batteryPercent: 90, origin: loc('downtown'), destination: loc('aswan'), stations: onlyCairo }));
    expect(plan.status).toBe('unreachable');
    expect(plan.strandedAtKm!).toBeGreaterThan(100);
    expect(plan.strandedAtKm!).toBeLessThan(plan.directKm);
  });

  it('reports an unreachable destination when there are no chargers', () => {
    const plan = planTrip(base({ batteryPercent: 20, destination: loc('aswan'), stations: [] }));
    expect(plan.status).toBe('unreachable');
    expect(plan.strandedAtKm).toBeGreaterThan(0);
    expect(plan.strandedAtKm!).toBeLessThan(plan.directKm);
    expect(plan.warnings[0]).toMatch(/No reachable charger/);
    expect(plan.path).toHaveLength(1);
  });

  it('only uses chargers a GB/T (China-spec) car can plug into, and counts the rest', () => {
    const id4cn = vehicleById('vw-id4-cn')!;
    const plan = planTrip(base({ vehicle: id4cn, batteryPercent: 25, destination: loc('alamein'), }));
    for (const stop of plan.stops) expect(isCompatible(id4cn, stop.station)).toBe(true);
    expect(plan.incompatibleOnRoute.length).toBeGreaterThan(0);
  });

  it('keeps every leg safe across many vehicles, batteries and destinations', () => {
    for (const vehicle of VEHICLES) {
      for (const soc of [15, 45, 90]) {
        for (const dest of PLACES) {
          const plan = planTrip(base({ vehicle, batteryPercent: soc, destination: dest.location, }));
          if (plan.status === 'unreachable') continue;
          expect(plan.arrivalPercent).toBeGreaterThanOrEqual(plan.reservePercent - 1e-9);
          for (const stop of plan.stops) {
            expect(stop.arrivalPercent).toBeGreaterThanOrEqual(3 - 1e-9);
            if (!stop.usesReserve) expect(stop.arrivalPercent).toBeGreaterThanOrEqual(plan.reservePercent - 1e-9);
            expect(stop.departurePercent).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });
});
