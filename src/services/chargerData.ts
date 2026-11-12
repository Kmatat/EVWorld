import { FeedStation, mergeFeeds, OcmPoi, ocmToStation, OcpiLocation, OcpiTariff, ocpiToStation } from '@/core/chargerFeeds';
import { liveStatus } from '@/core/stations';
import { STATIONS } from '@/data/stations';

/**
 * CHARGER DATA SOURCES
 * ====================
 * Production setup (see docs/CHARGER_DATA_EGYPT.md):
 *   - each charging network that agrees to share data gets an OCPI
 *     connection (or one roaming hub carries several networks);
 *   - Open Charge Map fills in locations of networks not yet connected;
 *   - the EVWorld server polls/receives these feeds, merges them, and the
 *     app reads one clean list from the server.
 *
 * These clients normally run on the server (credentials must never ship
 * inside the app). They live here so the mapping can be tested end to end.
 */

export interface ChargerSource {
  id: string;
  load(): Promise<FeedStation[]>;
}

/** OCPI 2.2.1 Locations + Tariffs, with paging (offset/limit and the Link header). */
export function ocpiSource(opts: { id: string; baseUrl: string; token: string; pageSize?: number; fetchImpl?: typeof fetch }): ChargerSource {
  const f = opts.fetchImpl ?? fetch;
  // OCPI 2.2 expects the credentials token Base64-encoded.
  const auth = { Authorization: `Token ${btoa(opts.token)}` };
  async function getAll<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let url: string | null = `${opts.baseUrl}${path}?offset=0&limit=${opts.pageSize ?? 100}`;
    while (url) {
      const res: Response = await f(url, { headers: auth });
      if (!res.ok) throw new Error(`OCPI ${path} failed: ${res.status}`);
      const body = (await res.json()) as { status_code: number; data: T[] };
      if (body.status_code !== 1000) throw new Error(`OCPI ${path} status ${body.status_code}`);
      out.push(...body.data);
      const link = res.headers.get('Link');
      url = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return out;
  }
  return {
    id: opts.id,
    async load() {
      const [locations, tariffs] = await Promise.all([getAll<OcpiLocation>('/locations'), getAll<OcpiTariff>('/tariffs').catch(() => [] as OcpiTariff[])]);
      return locations.map((l) => ocpiToStation(l, tariffs)).filter((x): x is FeedStation => !!x);
    },
  };
}

/** Open Charge Map: public locations in Egypt (no live status). Needs a free API key. */
export function openChargeMapSource(opts: { apiKey: string; fetchImpl?: typeof fetch }): ChargerSource {
  const f = opts.fetchImpl ?? fetch;
  return {
    id: 'openchargemap',
    async load() {
      const res = await f('https://api.openchargemap.io/v3/poi/?output=json&countrycode=EG&maxresults=1000&compact=false&verbose=false', {
        headers: { 'X-API-Key': opts.apiKey },
      });
      if (!res.ok) throw new Error(`Open Charge Map failed: ${res.status}`);
      const pois = (await res.json()) as OcmPoi[];
      return pois.map(ocmToStation).filter((x): x is FeedStation => !!x);
    },
  };
}

/** The prototype's demo data, in the same feed format. */
export const demoSource: ChargerSource = {
  id: 'demo',
  async load() {
    const now = Date.now();
    return STATIONS.map((station) => {
      const live = liveStatus(station, now);
      return { station, live: live.connectors, updatedAt: live.updatedAt, source: 'demo' as const };
    });
  },
};

/** Loads every source; one failing network doesn't take the others down. */
export async function loadAllChargers(sources: ChargerSource[]): Promise<{ stations: FeedStation[]; failed: string[] }> {
  const results = await Promise.allSettled(sources.map((s) => s.load()));
  const failed = sources.filter((_, i) => results[i].status === 'rejected').map((s) => s.id);
  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return { stations: mergeFeeds(all), failed };
}
