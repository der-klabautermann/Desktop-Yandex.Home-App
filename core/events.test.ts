import { describe, expect, it } from 'vitest';
import { detectEvents } from './events';
import type { HomeData } from './model';

const sensor = (id: string, instance: string, value: unknown, extra: object = {}) => ({
  id, name: id, type: 'devices.types.sensor', capabilities: [], provider_id: 'yandex',
  properties: [{ type: typeof value === 'number' ? 'devices.properties.float' : 'devices.properties.event', retrievable: true, reportable: true,
    parameters: { instance }, state: { instance, value } }],
  ...extra,
}) as any;

const home = (devices: any[]): HomeData => ({ status: 'ok', request_id: 'r', households: [], rooms: [], groups: [], scenarios: [], devices });
const at = 1_700_000_000_000;

describe('detectEvents', () => {
  it('erster Abruf meldet nichts', () => {
    expect(detectEvents(null, home([sensor('door', 'open', 'opened')]), [], [], at)).toEqual([]);
  });

  it('Tür geöffnet, Wasser, Rauch', () => {
    const prev = home([sensor('door', 'open', 'closed'), sensor('leak', 'water_leak', 'dry'), sensor('smoke', 'smoke', 'not_detected')]);
    const next = home([sensor('door', 'open', 'opened'), sensor('leak', 'water_leak', 'leak'), sensor('smoke', 'smoke', 'detected')]);
    const events = detectEvents(prev, next, [], [], at);
    expect(events.map(e => [e.kind, e.severity, e.deviceId])).toEqual([
      ['opened', 'info', 'door'], ['leak', 'alarm', 'leak'], ['smoke', 'alarm', 'smoke'],
    ]);
    expect(events[0].at).toBe(at);
  });

  it('keine Meldung, wenn sich nichts ändert', () => {
    const state = home([sensor('door', 'open', 'opened')]);
    expect(detectEvents(state, state, [], [], at)).toEqual([]);
  });

  it('Batterie fällt unter 15 Prozent', () => {
    const events = detectEvents(home([sensor('th', 'battery_level', 20)]), home([sensor('th', 'battery_level', 12)]), [], [], at);
    expect(events.map(e => [e.kind, e.value])).toEqual([['batteryLow', 12]]);
  });

  it('Gerät nicht erreichbar und wieder da', () => {
    const online = home([sensor('lamp', 'temperature', 20)]);
    const offline = home([sensor('lamp', 'temperature', 20, { unreachable: true })]);
    expect(detectEvents(online, offline, [], [], at).map(e => e.kind)).toEqual(['deviceOffline']);
    expect(detectEvents(offline, online, [], [], at).map(e => e.kind)).toEqual(['deviceOnline']);
  });

  it('Dienst fällt aus: eine Meldung für den Dienst statt für jedes Gerät', () => {
    const online = home([sensor('a', 'temperature', 20), sensor('b', 'temperature', 21)]);
    const offline = home([sensor('a', 'temperature', 20, { unreachable: true }), sensor('b', 'temperature', 21, { unreachable: true })]);
    const events = detectEvents(online, offline,
      [{ providerId: 'yandex', status: 'connected' }], [{ providerId: 'yandex', status: 'offline' }], at);
    expect(events.map(e => [e.kind, e.providerId])).toEqual([['serviceOffline', 'yandex']]);
  });

  it('Dienst wieder erreichbar', () => {
    const events = detectEvents(home([]), home([]), [{ providerId: 'aqara', status: 'offline' }], [{ providerId: 'aqara', status: 'connected' }], at);
    expect(events.map(e => e.kind)).toEqual(['serviceOnline']);
  });
});
