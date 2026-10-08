import { describe, expect, it } from 'vitest';
import { mergeHomes } from './merge';
import type { HomeData } from './model';

const yandex: HomeData = {
  status: 'ok', request_id: 'y',
  households: [{ id: 'h1', name: 'Циттау' }],
  rooms: [{ id: 'r1', name: 'Кухня', household_id: 'h1', devices: ['d1'] }],
  groups: [{ id: 'g1', name: 'Свет', household_id: 'h1', devices: ['d1'], capabilities: [] }],
  devices: [{ id: 'd1', name: 'Лампа', type: 'devices.types.light', room: 'r1', household_id: 'h1', capabilities: [] }],
  scenarios: [{ id: 's1', name: 'Ночь', is_active: true }],
};

const xiaomi: HomeData = {
  status: 'ok', request_id: 'x',
  households: [{ id: 'xiaomi:home1', name: ' циттау ' }, { id: 'xiaomi:home2', name: 'Дача' }],
  rooms: [
    { id: 'xiaomi:room1', name: 'кухня', household_id: 'xiaomi:home1', devices: ['xiaomi:dev1'] },
    { id: 'xiaomi:room2', name: 'Баня', household_id: 'xiaomi:home2', devices: ['xiaomi:dev2'] },
  ],
  groups: [],
  devices: [
    { id: 'xiaomi:dev1', name: 'Розетка', type: 'devices.types.socket', room: 'xiaomi:room1', household_id: 'xiaomi:home1', capabilities: [] },
    { id: 'xiaomi:dev2', name: 'Датчик', type: 'devices.types.sensor', room: 'xiaomi:room2', household_id: 'xiaomi:home2', capabilities: [] },
  ],
  scenarios: [],
};

describe('mergeHomes', () => {
  const merged = mergeHomes([{ providerId: 'yandex', data: yandex }, { providerId: 'xiaomi', data: xiaomi }]);

  it('legt gleichnamige Häuser zusammen und behält die erste ID', () => {
    expect(merged.households.map(h => h.id)).toEqual(['h1', 'xiaomi:home2']);
  });

  it('legt gleichnamige Räume im selben Haus zusammen', () => {
    const kitchen = merged.rooms.find(r => r.id === 'r1')!;
    expect(kitchen.devices).toEqual(['d1', 'xiaomi:dev1']);
    expect(merged.rooms.map(r => r.id)).toEqual(['r1', 'xiaomi:room2']);
  });

  it('hängt Geräte an den zusammengeführten Raum und das Haus', () => {
    const socket = merged.devices.find(d => d.id === 'xiaomi:dev1')!;
    expect(socket.room).toBe('r1');
    expect(socket.household_id).toBe('h1');
  });

  it('markiert die Herkunft', () => {
    expect(merged.devices.find(d => d.id === 'd1')!.provider_id).toBe('yandex');
    expect(merged.devices.find(d => d.id === 'xiaomi:dev2')!.provider_id).toBe('xiaomi');
    expect(merged.scenarios[0].provider_id).toBe('yandex');
  });

  it('ein einzelner Dienst bleibt unverändert bis auf die Herkunft', () => {
    const single = mergeHomes([{ providerId: 'yandex', data: yandex }]);
    expect(single.devices).toHaveLength(1);
    expect(single.rooms[0].devices).toEqual(['d1']);
  });

  it('markiert Geräte, Gruppen und Szenarien eines nicht erreichbaren Dienstes', () => {
    const offline = mergeHomes([{ providerId: 'yandex', data: yandex, unreachable: true }, { providerId: 'xiaomi', data: xiaomi }]);
    expect(offline.devices.find(d => d.id === 'd1')!.unreachable).toBe(true);
    expect(offline.groups[0].unreachable).toBe(true);
    expect(offline.scenarios[0].unreachable).toBe(true);
    expect(offline.devices.find(d => d.id === 'xiaomi:dev1')!.unreachable).toBeUndefined();
  });
});
