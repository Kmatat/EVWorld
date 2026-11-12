import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import EVMap from '@/components/map/EVMap';
import { MapPin } from '@/components/map/types';
import CommunityChargerCard, { communityFits } from '@/components/CommunityChargerCard';
import StationCard, { availabilityColor } from '@/components/StationCard';
import { Banner, Chip, ChipRow, Row, Screen, SearchBox, text } from '@/components/ui';
import { visibleLocation } from '@/core/community';
import { roadKm } from '@/core/roads';
import { filterStations, liveStatus, nearestStations } from '@/core/stations';
import { STATIONS } from '@/data/stations';
import { useNow } from '@/hooks/useNow';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useCommunityChargers } from '@/store/useCommunityStore';
import { colors, space } from '@/theme';

export default function ChargeScreen() {
  const vehicle = useVehicle();
  const now = useNow();
  const gps = useUserLocation();
  const filters = useAppStore((s) => s.stationFilters);
  const toggle = useAppStore((s) => s.toggleStationFilter);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'near' | 'all'>('near');
  const [showCommunity, setShowCommunity] = useState(true);
  const community = useCommunityChargers();
  const userId = useAuthStore((s) => s.user?.id);

  const results = useMemo(() => {
    const filtered = filterStations(
      STATIONS,
      {
        compatibleWith: filters.compatibleOnly ? vehicle : undefined,
        dcOnly: filters.dcOnly,
        availableOnly: filters.availableOnly,
        minPowerKw: filters.fastOnly ? 100 : undefined,
        query,
      },
      now,
    );
    return nearestStations(filtered, gps.location, filtered.length).map((r) => ({ ...r, live: liveStatus(r.station, now) }));
  }, [filters, vehicle, query, now, gps.location]);

  const freeCount = results.filter((r) => !r.live.offline && r.live.availablePlugs > 0).length;
  const shown = scope === 'near' && !query ? results.slice(0, 12) : results;

  // Community (home) chargers: shown at their public, possibly approximate, location.
  const q = query.trim().toLowerCase();
  const communityShown = !showCommunity || filters.dcOnly || filters.fastOnly
    ? []
    : community
        .filter((c) => !filters.compatibleOnly || communityFits(c, vehicle) !== 'no')
        .filter((c) => !q || `${c.title} ${c.area} ${c.city}`.toLowerCase().includes(q))
        .map((c) => ({ charger: c, location: visibleLocation(c, false, c.hostId === userId).location }))
        .map((x) => ({ ...x, km: roadKm(gps.location, x.location) }))
        .sort((a, b) => a.km - b.km)
        .filter((x, i) => scope === 'all' || !!q || i < 3 || x.km < 40);

  const pins: MapPin[] = [
    ...shown.map((r) => ({ id: r.station.id, location: r.station.location, kind: 'station' as const, color: availabilityColor(r.live), title: r.station.name })),
    ...communityShown.map((x) => ({ id: `community:${x.charger.id}`, location: x.location, kind: 'community' as const, color: colors.purple, title: x.charger.title })),
    { id: 'me', location: gps.location, kind: 'origin', color: colors.blue, title: 'You' },
  ];
  const fit = scope === 'near' && !query ? [gps.location, ...shown.slice(0, 5).map((r) => r.station.location)] : shown.map((r) => r.station.location);

  return (
    <Screen>
      <Pressable onPress={gps.request} accessibilityRole="button">
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={6} style={{ flex: 1 }}>
            <Ionicons name="locate" size={16} color={colors.blue} />
            <Text style={[text.small, { color: colors.inkSoft, flexShrink: 1 }]} numberOfLines={1}>
              {gps.loading ? 'Finding your location…' : gps.label}
            </Text>
          </Row>
          <Text style={{ color: colors.primaryDark, fontWeight: '600', fontSize: 13 }}>Use GPS</Text>
        </Row>
      </Pressable>

      <SearchBox value={query} onChangeText={setQuery} placeholder="Search city, mall or road (e.g. Sahel)" />

      <ChipRow>
        <Chip label="Fits my car" icon="car-outline" selected={filters.compatibleOnly} onPress={() => toggle('compatibleOnly')} />
        <Chip label="DC fast" icon="flash-outline" selected={filters.dcOnly} onPress={() => toggle('dcOnly')} />
        <Chip label="Free now" icon="checkmark-circle-outline" selected={filters.availableOnly} onPress={() => toggle('availableOnly')} />
        <Chip label="100 kW+" icon="rocket-outline" selected={filters.fastOnly} onPress={() => toggle('fastOnly')} />
        <Chip label="Community" icon="home-outline" selected={showCommunity} onPress={() => setShowCommunity((v) => !v)} />
      </ChipRow>

      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <Chip label="Nearby" selected={scope === 'near'} onPress={() => setScope('near')} />
          <Chip label="All Egypt" selected={scope === 'all'} onPress={() => setScope('all')} />
        </Row>
        <Text style={text.small}>
          {results.length} chargers · {freeCount} free now
        </Text>
      </Row>

      <EVMap
        pins={pins}
        fit={fit}
        height={300}
        onPinPress={(id) => {
          if (id === 'me') return;
          if (id.startsWith('community:')) router.push(`/community/${id.slice('community:'.length)}`);
          else router.push(`/station/${id}`);
        }}
      />

      <Row gap={14} style={{ paddingHorizontal: 4 }}>
        <Legend color={colors.primary} label="Free plug" />
        <Legend color={colors.red} label="All busy" />
        <Legend color={colors.faint} label="Offline" />
        <Legend color={colors.purple} label="Community" />
      </Row>

      <Banner text={`Showing chargers for your ${vehicle.make} ${vehicle.model}. Demo data: operators are fictional and live status is simulated.`} />

      {shown.length === 0 ? (
        <Banner tone="amber" icon="search-outline" text="No chargers match these filters. Try removing a filter or searching another area." />
      ) : null}

      {communityShown.length ? (
        <View style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={text.h3}>Community chargers near you</Text>
            <Pressable onPress={() => router.push('/community/host')}>
              <Text style={{ color: colors.primaryDark, fontWeight: '600' }}>Share yours</Text>
            </Pressable>
          </Row>
          {communityShown.slice(0, scope === 'all' || q ? 20 : 2).map((x) => (
            <CommunityChargerCard key={x.charger.id} charger={x.charger} vehicle={vehicle} distanceKm={x.km} />
          ))}
          <Text style={text.h3}>Public chargers</Text>
        </View>
      ) : null}

      <View style={{ gap: space.md }}>
        {shown.map((r) => (
          <StationCard key={r.station.id} live={r.live} vehicle={vehicle} distanceKm={r.roadKm} now={now} onPress={() => router.push(`/station/${r.station.id}`)} />
        ))}
      </View>
      {scope === 'near' && !query && results.length > shown.length ? (
        <Pressable onPress={() => setScope('all')} style={{ alignItems: 'center', padding: space.md }}>
          <Text style={{ color: colors.primaryDark, fontWeight: '700' }}>Show all {results.length} chargers</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={5}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={text.small}>{label}</Text>
    </Row>
  );
}
