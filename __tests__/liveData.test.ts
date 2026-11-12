import { analyzeDrivingStyle, climateRegion, inferClimateOn, parseOpenMeteoTemperature, profileFromDistance, SpeedSample, tripTemperature, typicalTemperature } from '@/core/autoConditions';
import { chargerPoiScreen, tripInfoScreen } from '@/core/carScreens';
import { addDistance, applyReading, currentPercent, shouldReplan, startLiveBattery, updateConsumptionFactor } from '@/core/liveBattery';
import { estimateRange } from '@/core/range';
import { planTrip } from '@/core/tripPlanner';
import { placeById } from '@/data/places';
import { STATIONS } from '@/data/stations';
import { vehicleById } from '@/data/vehicles';

const atto3 = vehicleById('byd-atto3')!;

describe('live battery during a trip', () => {
  it('estimates the drop from distance driven', () => {
    let s = startLiveBattery(80, 200);
    s = addDistance(s, 30.25); // 30.25 km × 200 Wh = 6.05 kWh = 10% of 60.5 kWh
    expect(currentPercent(s, atto3)).toBeCloseTo(70, 5);
  });

  it('snaps to real car readings and learns the real consumption', () => {
    let s = startLiveBattery(80, 200, 'car');
    s = addDistance(s, 30.25);
    // The car says 68%, not the estimated 70%: real use was 240 Wh/km.
    s = applyReading(s, { percent: 68, at: 1, source: 'car' }, atto3);
    expect(currentPercent(s, atto3)).toBe(68);
    expect(s.learnedWhPerKm).toBeCloseTo(240, 0);
    expect(s.whPerKm).toBeCloseTo(240, 0);
    s = addDistance(s, 25.2);
    expect(currentPercent(s, atto3)).toBeCloseTo(68 - (25.2 * 240) / 605, 3);
  });

  it('does not learn from manual corrections, tiny distances or charging', () => {
    let s = startLiveBattery(80, 200, 'manual');
    s = addDistance(s, 1);
    s = applyReading(s, { percent: 79, at: 1, source: 'car' }, atto3); // < 3 km
    expect(s.learnedWhPerKm).toBeUndefined();
    s = addDistance(s, 10);
    s = applyReading(s, { percent: 90, at: 2, source: 'car' }, atto3); // went up: charged
    expect(s.learnedWhPerKm).toBeUndefined();
    s = addDistance(s, 10);
    s = applyReading(s, { percent: 85, at: 3, source: 'manual' }, atto3);
    expect(s.learnedWhPerKm).toBeUndefined();
    expect(currentPercent(s, atto3)).toBe(85);
  });

  it('turns real readings into a personal factor that changes range and plans', () => {
    let s = startLiveBattery(80, 200, 'car');
    s = addDistance(s, 30.25);
    s = applyReading(s, { percent: 68, at: 1, source: 'car' }, atto3); // 240 Wh/km observed
    const factor = updateConsumptionFactor(undefined, s, 200)!;
    expect(factor).toBeCloseTo(1.2, 2);
    expect(updateConsumptionFactor(1.0, s, 200)!).toBeGreaterThan(1.0);
    expect(updateConsumptionFactor(1.1, startLiveBattery(50, 200), 200)).toBe(1.1);
    const conditions = { profile: 'highway' as const, temperatureC: 32, climateOn: true, style: 'normal' as const, passengers: 2 };
    expect(estimateRange(atto3, 80, conditions, 10, factor).safeRangeKm).toBeLessThan(estimateRange(atto3, 80, conditions, 10).safeRangeKm);
    const base = { vehicle: atto3, batteryPercent: 60, origin: placeById('downtown')!.location, destination: placeById('alex')!.location, conditions, stations: STATIONS, now: Date.UTC(2026, 10, 12, 9) };
    expect(planTrip({ ...base, consumptionFactor: 1.2 }).whPerKm).toBeCloseTo(planTrip(base).whPerKm * 1.2, 5);
  });

  it('asks for a new plan when reality drifts from the plan', () => {
    expect(shouldReplan({ expectedPercent: 50, actualPercent: 46, kmSinceLastPlan: 2, minutesSinceLastPlan: 1 })).toBe(true);
    expect(shouldReplan({ expectedPercent: 50, actualPercent: 49, kmSinceLastPlan: 2, minutesSinceLastPlan: 1 })).toBe(false);
    expect(shouldReplan({ expectedPercent: 50, actualPercent: 49, kmSinceLastPlan: 30, minutesSinceLastPlan: 1 })).toBe(true);
  });
});

describe('automatic conditions', () => {
  it('knows Egypt is hotter in Luxor than Alexandria in July', () => {
    const july = new Date(2026, 6, 15, 14);
    expect(climateRegion(placeById('luxor')!.location)).toBe('upper');
    expect(climateRegion(placeById('alex')!.location)).toBe('coast');
    expect(climateRegion(placeById('hurghada')!.location)).toBe('redsea');
    expect(typicalTemperature(placeById('luxor')!.location, july)).toBeGreaterThan(typicalTemperature(placeById('alex')!.location, july));
    expect(typicalTemperature(placeById('downtown')!.location, new Date(2026, 6, 15, 23))).toBeLessThan(typicalTemperature(placeById('downtown')!.location, july));
  });

  it('reads the Open-Meteo response and handles bad data', () => {
    expect(parseOpenMeteoTemperature({ current: { time: '2026-11-12T12:00', temperature_2m: 27.4 } })).toBe(27.4);
    expect(parseOpenMeteoTemperature({ error: true })).toBeUndefined();
    expect(parseOpenMeteoTemperature(null)).toBeUndefined();
    expect(tripTemperature(24, 31.6)).toBe(32);
  });

  it('assumes AC in the heat and picks the road type from distance', () => {
    expect(inferClimateOn(34)).toBe(true);
    expect(inferClimateOn(21)).toBe(false);
    expect(inferClimateOn(9)).toBe(true);
    expect(profileFromDistance(12)).toBe('city');
    expect(profileFromDistance(220)).toBe('highway');
  });

  const drive = (pattern: (t: number) => number, seconds = 900): SpeedSample[] =>
    Array.from({ length: seconds / 2 }, (_, i) => ({ t: i * 2, speedKmh: Math.max(0, pattern(i * 2)) }));

  it('detects smooth vs aggressive driving', () => {
    const smooth = analyzeDrivingStyle(drive((t) => Math.min(90, t * 0.5)))!;
    expect(smooth.style).toBe('eco');
    // Repeated hard launches and stops in traffic.
    const aggressive = analyzeDrivingStyle(drive((t) => ((t % 30) < 10 ? (t % 30) * 9 : 90 - ((t % 30) - 10) * 4.5)))!;
    expect(aggressive.style).toBe('sporty');
    const fast = analyzeDrivingStyle(drive(() => 140))!;
    expect(fast.style).toBe('sporty');
    expect(analyzeDrivingStyle([])).toBeUndefined();
  });
});

describe('car screens (CarPlay / Android Auto)', () => {
  const now = Date.UTC(2026, 10, 12, 9, 0, 0);

  it('lists nearby compatible chargers within the platform limit', () => {
    const screen = chargerPoiScreen(STATIONS, atto3, placeById('new-cairo')!.location, now, 6);
    expect(screen.items.length).toBeLessThanOrEqual(6);
    expect(screen.items.length).toBeGreaterThan(0);
    for (const item of screen.items) {
      expect(item.title.length).toBeLessThanOrEqual(28);
      expect(item.detail).toMatch(/km · \d+\/\d+ free · \d+ kW/);
    }
  });

  it('summarises the trip for the car display', () => {
    const plan = planTrip({ vehicle: atto3, batteryPercent: 40, origin: placeById('downtown')!.location, destination: placeById('alamein')!.location, conditions: { profile: 'highway', temperatureC: 32, climateOn: true, style: 'normal', passengers: 2 }, stations: STATIONS, now });
    const info = tripInfoScreen({ plan, batteryPercent: 40, batterySourceLabel: 'from car', kmDriven: 0, destinationName: 'New Alamein' });
    expect(info.rows[0].value).toContain('40%');
    expect(info.rows.some((r) => r.label === 'Next charge')).toBe(true);
    expect(info.rows.length).toBeLessThanOrEqual(5);
    expect(info.actions[0].title).toBe('Navigate to charger');
    // After charging at the only stop, the car screen shows no more stops and the live range.
    const after = tripInfoScreen({ plan, batteryPercent: 80, batterySourceLabel: 'from car', kmDriven: 70, destinationName: 'New Alamein', rangeKm: 199, doneStopIds: plan.stops.map((s) => s.station.id), progressKm: 70 });
    expect(after.title).toBe('On track, no charging needed');
    expect(after.rows.some((r) => r.label === 'Next charge')).toBe(false);
    expect(after.rows[1].value).toBe('199 km');
  });
});
