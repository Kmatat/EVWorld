import { isStatusStale, mergeFeeds, OcmPoi, ocmConnectorType, ocmToStation, OcpiLocation, OcpiTariff, ocpiToStation, parsePricePerKwh } from '@/core/chargerFeeds';
import { loadAllChargers, ocpiSource } from '@/services/chargerData';

/** A realistic OCPI 2.2.1 location as a charging network would send it. */
const location: OcpiLocation = {
  country_code: 'EG',
  party_id: 'ABC',
  id: 'LOC-001',
  publish: true,
  name: 'Ring Road Fast Hub',
  address: 'Ring Road, exit 14',
  city: 'New Cairo',
  coordinates: { latitude: '30.02870', longitude: '31.40850' },
  operator: { name: 'Example CPO' },
  facilities: ['MALL', 'CAFE', 'PARKING_LOT'],
  opening_times: { twentyfourseven: true },
  last_updated: '2026-11-12T08:55:00Z',
  evses: [
    { uid: 'E1', status: 'AVAILABLE', last_updated: '2026-11-12T08:58:00Z', connectors: [{ id: '1', standard: 'IEC_62196_T2_COMBO', power_type: 'DC', max_voltage: 920, max_amperage: 200, max_electric_power: 120000, tariff_ids: ['DC'] }] },
    { uid: 'E2', status: 'CHARGING', last_updated: '2026-11-12T08:57:00Z', connectors: [{ id: '1', standard: 'IEC_62196_T2_COMBO', power_type: 'DC', max_voltage: 920, max_amperage: 200, max_electric_power: 120000, tariff_ids: ['DC'] }] },
    { uid: 'E3', status: 'OUTOFORDER', last_updated: '2026-11-12T07:00:00Z', connectors: [{ id: '1', standard: 'IEC_62196_T2', power_type: 'AC_3_PHASE', max_voltage: 230, max_amperage: 32, tariff_ids: ['AC'] }] },
    { uid: 'E4', status: 'PLANNED', last_updated: '2026-11-12T07:00:00Z', connectors: [{ id: '1', standard: 'GBT_DC', power_type: 'DC', max_voltage: 750, max_amperage: 80 }] },
  ],
};

const tariffs: OcpiTariff[] = [
  { id: 'DC', currency: 'EGP', elements: [{ price_components: [{ type: 'ENERGY', price: 10, vat: 14, step_size: 1 }] }] },
  { id: 'AC', currency: 'EGP', elements: [{ price_components: [{ type: 'ENERGY', price: 5, step_size: 1 }] }] },
];

describe('OCPI feed', () => {
  it('maps a location to a station with live plug counts and price', () => {
    const f = ocpiToStation(location, tariffs)!;
    expect(f.station.id).toBe('ocpi:EG:ABC:LOC-001');
    expect(f.station.location).toEqual({ lat: 30.0287, lng: 31.4085 });
    expect(f.station.open24h).toBe(true);
    expect(f.station.amenities).toEqual(['mall', 'cafe']);
    expect(f.station.pricePerKwh).toBe(11.4); // 10 + 14% VAT
    const dc = f.live.find((c) => c.type === 'ccs2')!;
    expect(dc).toMatchObject({ powerKw: 120, count: 2, available: 1, occupied: 1, offline: 0 });
    const ac = f.live.find((c) => c.type === 'type2')!;
    expect(ac).toMatchObject({ powerKw: 22, count: 1, offline: 1 }); // 230 V × 32 A × 3 phases
    expect(f.live.some((c) => c.type === 'gbt_dc')).toBe(false); // planned, not built yet
    expect(f.updatedAt).toBe(Date.parse('2026-11-12T08:58:00Z'));
  });

  it('skips unpublished locations and locations without usable plugs', () => {
    expect(ocpiToStation({ ...location, publish: false })).toBeUndefined();
    expect(ocpiToStation({ ...location, evses: [] })).toBeUndefined();
    expect(ocpiToStation({ ...location, coordinates: { latitude: 'x', longitude: '1' } })).toBeUndefined();
  });
});

describe('Open Charge Map feed', () => {
  const poi: OcmPoi = {
    ID: 12345,
    OperatorInfo: { Title: 'Example Network' },
    UsageCost: 'EGP 3.75/kWh',
    AddressInfo: { Title: 'Mall Parking B2', AddressLine1: 'Main Road', Town: 'Giza', Latitude: 29.97, Longitude: 31.01 },
    Connections: [
      { ConnectionType: { Title: 'CCS (Type 2)' }, PowerKW: 60, Quantity: 2, StatusType: { IsOperational: true } },
      { ConnectionType: { Title: 'Type 2 (Socket Only)' }, PowerKW: 22, Quantity: 1 },
      { ConnectionType: { Title: 'GB-T DC - GB/T 20234.3' }, PowerKW: 60, Quantity: 1 },
      { ConnectionType: { Title: 'Tesla (Model S/X)' }, PowerKW: 11 },
    ],
  };

  it('maps plug titles and free-text prices', () => {
    expect(ocmConnectorType('CCS (Type 2)')).toBe('ccs2');
    expect(ocmConnectorType('CCS (Type 1)')).toBeUndefined();
    expect(ocmConnectorType('GB-T AC - GB/T 20234.2 (Socket)')).toBe('gbt_ac');
    expect(ocmConnectorType('CHAdeMO')).toBe('chademo');
    expect(parsePricePerKwh('EGP 3.75/kWh')).toBe(3.75);
    expect(parsePricePerKwh('3,75 جنيه للكيلووات kWh')).toBe(3.75);
    expect(parsePricePerKwh('Free')).toBeUndefined();
  });

  it('maps a POI to a station', () => {
    const f = ocmToStation(poi)!;
    expect(f.station.connectors).toEqual([
      { type: 'ccs2', powerKw: 60, count: 2 },
      { type: 'type2', powerKw: 22, count: 1 },
      { type: 'gbt_dc', powerKw: 60, count: 1 },
    ]);
    expect(f.station.pricePerKwh).toBe(3.75);
    expect(ocmToStation({ ...poi, StatusType: { IsOperational: false } })).toBeUndefined();
  });

  it('merges duplicate sites, preferring live OCPI data and filling missing prices', () => {
    const ocpi = ocpiToStation({ ...location, coordinates: { latitude: '29.97010', longitude: '31.01010' } }, [])!; // no tariff → no price
    const ocm = ocmToStation(poi)!; // ~14 m away, has a price
    const other = ocmToStation({ ...poi, ID: 2, AddressInfo: { ...poi.AddressInfo, Latitude: 30.5, Longitude: 31.5 } })!;
    const merged = mergeFeeds([ocm, other, ocpi]);
    expect(merged).toHaveLength(2);
    const site = merged.find((m) => m.source === 'ocpi')!;
    expect(site.station.pricePerKwh).toBe(3.75);
  });

  it('flags stale live status', () => {
    const now = Date.parse('2026-11-12T09:00:00Z');
    expect(isStatusStale(Date.parse('2026-11-12T08:58:00Z'), now)).toBe(false);
    expect(isStatusStale(Date.parse('2026-11-12T08:30:00Z'), now)).toBe(true);
  });
});

describe('OCPI client', () => {
  it('pages through locations, sends the token and survives a failing network', async () => {
    const calls: { url: string; auth: string }[] = [];
    const page = (data: unknown[], next?: string) =>
      ({ ok: true, status: 200, headers: { get: (h: string) => (h === 'Link' && next ? `<${next}>; rel="next"` : null) }, json: async () => ({ status_code: 1000, data }) }) as unknown as Response;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: String((init?.headers as Record<string, string>).Authorization) });
      if (url.includes('/tariffs')) return page(tariffs);
      if (url.includes('offset=0')) return page([location], 'https://cpo.example/ocpi/2.2.1/locations?offset=1&limit=1');
      return page([{ ...location, id: 'LOC-002', coordinates: { latitude: '31.2', longitude: '29.9' } }]);
    }) as typeof fetch;
    const broken = { id: 'broken', load: async () => { throw new Error('down'); } };
    const result = await loadAllChargers([ocpiSource({ id: 'cpo', baseUrl: 'https://cpo.example/ocpi/2.2.1', token: 'secret', pageSize: 1, fetchImpl: fakeFetch }), broken]);
    expect(result.stations).toHaveLength(2);
    expect(result.failed).toEqual(['broken']);
    expect(calls.filter((c) => c.url.includes('/locations'))).toHaveLength(2);
    expect(calls[0].auth).toBe(`Token ${btoa('secret')}`);
  });
});
