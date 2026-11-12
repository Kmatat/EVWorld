import { buildCheckout, COD_FEE_EGP, COMMISSION_RATE, productFits, sellerEarnings } from '@/core/marketplace';
import { liveStatus, filterStations, nearestStations } from '@/core/stations';
import { PRODUCTS, VENDORS } from '@/data/marketplace';
import { STATIONS } from '@/data/stations';
import { vehicleById } from '@/data/vehicles';
import { placeById } from '@/data/places';

describe('multivendor checkout', () => {
  it('splits one basket into one order per vendor', () => {
    const summary = buildCheckout(
      [
        { productId: 'p-cable-t2', quantity: 1 }, // VoltGear
        { productId: 'p-dashcam', quantity: 1 }, // VoltGear
        { productId: 'p-mats-atto3', quantity: 2 }, // AutoStyle
      ],
      PRODUCTS,
      VENDORS,
    );
    expect(summary.orders).toHaveLength(2);
    expect(summary.itemCount).toBe(4);
    const voltgear = summary.orders.find((o) => o.vendor.id === 'v-voltgear')!;
    expect(voltgear.subtotal).toBe(6500 + 4200);
    expect(voltgear.delivery).toBe(0); // over the free-delivery threshold
    const autostyle = summary.orders.find((o) => o.vendor.id === 'v-autostyle')!;
    expect(autostyle.delivery).toBe(50);
    expect(summary.grandTotal).toBe(6500 + 4200 + 3200 * 2 + 50);
  });

  it('calculates commission per category and the vendor payout', () => {
    const summary = buildCheckout([{ productId: 'p-mats-atto3', quantity: 1 }], PRODUCTS, VENDORS);
    const order = summary.orders[0];
    expect(order.commission).toBeCloseTo(3200 * COMMISSION_RATE.interior, 2);
    expect(order.payout).toBeCloseTo(3200 - order.commission + order.delivery, 2);
    expect(summary.platformCommission).toBeCloseTo(order.commission, 2);
  });

  it('adds a cash-on-delivery fee per vendor order and caps quantity at stock', () => {
    const summary = buildCheckout(
      [
        { productId: 'p-adapter-ccs-gbt', quantity: 50 }, // only 6 in stock
        { productId: 'p-wallbox7', quantity: 1 },
      ],
      PRODUCTS,
      VENDORS,
      'cod',
    );
    expect(summary.paymentFee).toBe(COD_FEE_EGP * 2);
    expect(summary.orders.find((o) => o.vendor.id === 'v-chargego')!.lines[0].quantity).toBe(6);
  });

  it('ignores unknown products and empty lines', () => {
    const summary = buildCheckout([{ productId: 'nope', quantity: 1 }, { productId: 'p-dashcam', quantity: 0 }], PRODUCTS, VENDORS);
    expect(summary.orders).toHaveLength(0);
    expect(summary.grandTotal).toBe(0);
  });

  it('matches products to the driver\'s car', () => {
    const atto3 = vehicleById('byd-atto3')!;
    const id4cn = vehicleById('vw-id4-cn')!;
    const byId = (id: string) => PRODUCTS.find((p) => p.id === id)!;
    expect(productFits(byId('p-mats-atto3'), atto3)).toBe(true);
    expect(productFits(byId('p-mats-atto3'), id4cn)).toBe(false);
    expect(productFits(byId('p-adapter-ccs-gbt'), id4cn)).toBe(true);
    expect(productFits(byId('p-adapter-ccs-gbt'), atto3)).toBe(false);
    expect(productFits(byId('p-dashcam'), id4cn)).toBe(true);
  });

  it('shows a seller what they keep', () => {
    const e = sellerEarnings(10000, 'cables_adapters');
    expect(e.commission).toBe(1000);
    expect(e.payout).toBe(9000);
    expect(e.platformNet).toBeLessThan(e.commission);
  });
});

describe('stations', () => {
  const now = Date.UTC(2026, 10, 12, 9, 0, 0);

  it('produces stable live status within a 5-minute window and changes later', () => {
    const s = STATIONS[0];
    expect(liveStatus(s, now)).toEqual(liveStatus(s, now + 1000));
    const statuses = new Set(Array.from({ length: 30 }, (_, i) => liveStatus(s, now + i * 5 * 60 * 1000).availablePlugs));
    expect(statuses.size).toBeGreaterThan(1);
    const live = liveStatus(s, now);
    for (const c of live.connectors) expect(c.available + c.occupied + c.offline).toBe(c.count);
  });

  it('filters by car compatibility, DC and search text', () => {
    const id4cn = vehicleById('vw-id4-cn')!;
    const gbt = filterStations(STATIONS, { compatibleWith: id4cn }, now);
    expect(gbt.length).toBeGreaterThan(0);
    expect(gbt.length).toBeLessThan(STATIONS.length);
    expect(filterStations(STATIONS, { dcOnly: true }, now).every((s) => s.connectors.some((c) => c.type !== 'type2'))).toBe(true);
    expect(filterStations(STATIONS, { query: 'alexandria' }, now).length).toBeGreaterThan(0);
  });

  it('sorts nearest stations by distance', () => {
    const near = nearestStations(STATIONS, placeById('alex')!.location, 3);
    expect(near).toHaveLength(3);
    expect(near[0].distanceKm).toBeLessThanOrEqual(near[1].distanceKm);
    expect(near[0].station.region).toBe('Alexandria');
  });
});
