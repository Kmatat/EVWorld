import Slider from '@react-native-community/slider';
import { Text, View } from 'react-native';

import { formatKm } from '@/core/geo';
import { estimateRange } from '@/core/range';
import { useAppStore, useVehicle } from '@/store/useAppStore';
import { batteryColor, colors, space } from '@/theme';

import { BatteryBar, Card, Chip, Row, text } from './ui';

/**
 * Battery level input. In the prototype the driver enters it. With a
 * connected-car integration it fills in automatically (see My EV tab).
 */
export default function BatteryControl({ compact }: { compact?: boolean }) {
  const vehicle = useVehicle();
  const battery = useAppStore((s) => s.batteryPercent);
  const setBattery = useAppStore((s) => s.setBattery);
  const reserve = useAppStore((s) => s.reservePercent);
  const conditions = useAppStore((s) => s.conditions);
  const range = estimateRange(vehicle, battery, conditions, reserve);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={text.small}>Battery now</Text>
          <Text style={{ fontSize: 40, fontWeight: '800', color: batteryColor(battery), lineHeight: 46 }}>{battery}%</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={text.small}>Safe range ({reserve}% kept)</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.ink }}>{formatKm(range.safeRangeKm)}</Text>
          <Text style={text.small}>{formatKm(range.absoluteRangeKm)} to empty</Text>
        </View>
      </Row>
      <View style={{ marginTop: space.md }}>
        <BatteryBar percent={battery} height={12} marker={reserve} />
      </View>
      <Slider
        style={{ width: '100%', height: 40, marginTop: 4 }}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={battery}
        onValueChange={(v: number) => setBattery(v)}
        minimumTrackTintColor={batteryColor(battery)}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primaryDark}
        accessibilityLabel="Battery percentage"
      />
      {!compact ? (
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {[15, 30, 50, 80, 100].map((p) => (
            <Chip key={p} label={`${p}%`} selected={battery === p} onPress={() => setBattery(p)} />
          ))}
        </Row>
      ) : null}
      <Text style={[text.small, { marginTop: space.sm }]}>
        {vehicle.make} {vehicle.model} · {vehicle.usableKwh} kWh usable · based on {conditions.profile} driving at {conditions.temperatureC}°C
      </Text>
    </Card>
  );
}
