import { chargeMinutes, isCompatible, billedKwh } from '@/core/charging';
import { haversineKm } from '@/core/geo';
import { roadKm, routeShape } from '@/core/roads';
import { consumption, DEFAULT_CONDITIONS, estimateRange } from '@/core/range';
import { DrivingConditions } from '@/core/types';
import { placeById } from '@/data/places';
import { stationById } from '@/data/stations';
import { vehicleById } from '@/data/vehicles';

const atto3 = vehicleById('byd-atto3')!;
const id4cn = vehicleById('vw-id4-cn')!;

const mild: DrivingConditions = { profile: 'mixed', temperatureC: 22, climateOn: true, style: 'normal', passengers: 1 };

describe('geo', () => {
  it('measures Cairo → Alexandria at roughly 180 km straight line', () => {
    const d = haversineKm(placeById('downtown')!.location, placeById('alex')!.location);
    expect(d).toBeGreaterThan(170);
    expect(d).toBeLessThan(190);
    expect(roadKm(placeById('downtown')!.location, placeById('alex')!.location)).toBeGreaterThan(d);
  });
});

describe('road network', () => {
  const km = (a: string, b: string) => roadKm(placeById(a)!.location, placeById(b)!.location);

  it('lands close to real Egyptian road distances', () => {
    expect(km('downtown', 'alex')).toBeGreaterThan(200);
    expect(km('downtown', 'alex')).toBeLessThan(245);
    expect(km('downtown', 'hurghada')).toBeGreaterThan(430);
    expect(km('downtown', 'hurghada')).toBeLessThan(500);
    expect(km('downtown', 'sharm')).toBeGreaterThan(470);
    expect(km('downtown', 'sharm')).toBeLessThan(540);
    expect(km('downtown', 'aswan')).toBeGreaterThan(800);
    expect(km('downtown', 'aswan')).toBeLessThan(920);
  });

  it('goes around the Gulf of Suez instead of across it', () => {
    const zafarana = stationById('rs-04')!.location;
    const elTor = stationById('sn-02')!.location;
    expect(haversineKm(zafarana, elTor)).toBeLessThan(150);
    expect(roadKm(zafarana, elTor)).toBeGreaterThan(300);
    // Short hop across the water: Porto Sokhna (Africa) → Ras Sudr (Sinai) is ~37 km straight.
    const portoSokhna = stationById('rs-02')!.location;
    const rasSudr = stationById('sn-01')!.location;
    expect(haversineKm(portoSokhna, rasSudr)).toBeLessThan(40);
    expect(roadKm(portoSokhna, rasSudr)).toBeGreaterThan(100);
    expect(routeShape(portoSokhna, rasSudr).length).toBeGreaterThan(2);
    const shape = routeShape(placeById('downtown')!.location, placeById('sharm')!.location);
    // The drawn route passes near the Ahmed Hamdi tunnel (north of Suez).
    expect(shape.some((p) => Math.abs(p.lat - 30.09) < 0.05 && Math.abs(p.lng - 32.57) < 0.05)).toBe(true);
  });

  it('uses a direct estimate for short city trips', () => {
    const d = km('new-cairo', 'heliopolis');
    expect(d).toBeGreaterThan(haversineKm(placeById('new-cairo')!.location, placeById('heliopolis')!.location));
    expect(d).toBeLessThan(30);
  });
});

describe('range engine', () => {
  it('gives a realistic full-battery range below the official WLTP figure', () => {
    const r = estimateRange(atto3, 100, mild, 0);
    expect(r.absoluteRangeKm).toBeLessThan(atto3.wltpKm);
    expect(r.absoluteRangeKm).toBeGreaterThan(atto3.wltpKm * 0.75);
  });

  it('scales with battery percentage and respects the reserve', () => {
    const half = estimateRange(atto3, 50, DEFAULT_CONDITIONS);
    const full = estimateRange(atto3, 100, DEFAULT_CONDITIONS);
    expect(full.absoluteRangeKm).toBeCloseTo(half.absoluteRangeKm * 2, 5);
    expect(half.safeRangeKm).toBeLessThan(half.absoluteRangeKm);
    expect(estimateRange(atto3, 5, DEFAULT_CONDITIONS, 10).safeRangeKm).toBe(0);
  });

  it('uses more energy on the highway, in heat, when driving hard and with passengers', () => {
    const base = consumption(atto3, mild).totalWhPerKm;
    expect(consumption(atto3, { ...mild, profile: 'highway' }).totalWhPerKm).toBeGreaterThan(base);
    expect(consumption(atto3, { ...mild, temperatureC: 42 }).totalWhPerKm).toBeGreaterThan(base);
    expect(consumption(atto3, { ...mild, style: 'sporty' }).totalWhPerKm).toBeGreaterThan(base);
    expect(consumption(atto3, { ...mild, passengers: 5 }).totalWhPerKm).toBeGreaterThan(base);
    expect(consumption(atto3, { ...mild, style: 'eco' }).totalWhPerKm).toBeLessThan(base);
  });

  it('makes AC matter more in slow city traffic than on the highway', () => {
    const city = consumption(atto3, { ...mild, profile: 'city', temperatureC: 40 });
    const highway = consumption(atto3, { ...mild, profile: 'highway', temperatureC: 40 });
    expect(city.climateWhPerKm).toBeGreaterThan(highway.climateWhPerKm * 2);
  });
});

describe('charging model', () => {
  const dc = { type: 'ccs2' as const, powerKw: 120, count: 1 };
  const ac = { type: 'type2' as const, powerKw: 22, count: 1 };

  it('estimates a 10→80% DC session for an Atto 3 at around 35–45 minutes', () => {
    const m = chargeMinutes(atto3, dc, 10, 80);
    expect(m).toBeGreaterThan(30);
    expect(m).toBeLessThan(50);
  });

  it('is limited by the car, not the charger (Atto 3 accepts 7 kW AC even on a 22 kW post)', () => {
    const m = chargeMinutes(atto3, ac, 20, 100);
    expect(m / 60).toBeGreaterThan(7);
    expect(m / 60).toBeLessThan(10);
  });

  it('slows down above 80%', () => {
    const lower = chargeMinutes(atto3, dc, 70, 80);
    const upper = chargeMinutes(atto3, dc, 85, 95);
    expect(upper).toBeGreaterThan(lower * 1.5);
  });

  it('returns zero time when no charging is needed and bills for losses', () => {
    expect(chargeMinutes(atto3, dc, 80, 50)).toBe(0);
    expect(billedKwh(atto3, 0, 100)).toBeGreaterThan(atto3.usableKwh);
  });

  it('knows a China-spec GB/T car cannot use a CCS2-only station', () => {
    const zafarana = stationById('rs-04')!; // CCS2 only
    expect(isCompatible(atto3, zafarana)).toBe(true);
    expect(isCompatible(id4cn, zafarana)).toBe(false);
    expect(isCompatible(id4cn, stationById('dsr-01')!)).toBe(true); // has GB/T DC
  });
});
