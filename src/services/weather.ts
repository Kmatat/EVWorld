import { parseOpenMeteoTemperature, typicalTemperature } from '@/core/autoConditions';
import { LatLng } from '@/core/types';

/**
 * Outside temperature for the range calculation.
 *
 * Live: Open-Meteo forecast API (no key needed). Its free tier is for
 * non-commercial use only, so the launched app needs a paid Open-Meteo plan
 * or another provider (Apple WeatherKit, Google Weather API,
 * OpenWeatherMap). Only this file changes.
 * Offline / blocked: typical temperature for the region and month.
 */

export interface TemperatureReading {
  celsius: number;
  source: 'live' | 'typical';
  at: number;
}

const cache = new Map<string, TemperatureReading>();
const CACHE_MS = 30 * 60 * 1000;

export async function getTemperature(p: LatLng, now = new Date()): Promise<TemperatureReading> {
  const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
  const hit = cache.get(key);
  if (hit && now.getTime() - hit.at < CACHE_MS) return hit;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(3)}&longitude=${p.lng.toFixed(3)}&current=temperature_2m`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const t = res.ok ? parseOpenMeteoTemperature(await res.json()) : undefined;
    if (t != null) {
      const reading = { celsius: Math.round(t), source: 'live' as const, at: now.getTime() };
      cache.set(key, reading);
      return reading;
    }
  } catch {
    // Offline, blocked, or timed out: fall through to the typical value.
  }
  return { celsius: typicalTemperature(p, now), source: 'typical', at: now.getTime() };
}
