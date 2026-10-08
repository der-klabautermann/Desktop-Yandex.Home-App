import { describe, expect, it } from 'vitest';
import {
  EMPTY_ZONE_CONFIG, addZone, buildZoneTree, flattenTree, isZoneActive, moveNode, removeZone, renameZone, summarizeDevices,
  type ZoneConfig,
} from './zones';
import type { HomeData } from './model';

const onOff = (value: boolean) => ({ type: 'devices.capabilities.on_off', retrievable: true, reportable: true, state: { instance: 'on', value } });
const prop = (type: string, instance: string, value: unknown) => ({ type, retrievable: true, reportable: true, parameters: { instance }, state: { instance, value } }) as any;

const home: HomeData = {
  status: 'ok', request_id: 'r',
  households: [{ id: 'h1', name: 'Дом' }, { id: 'h2', name: 'Дача' }],
  rooms: [
    { id: 'kitchen', name: 'Кухня', household_id: 'h1', devices: ['lamp', 'plug'] },
    { id: 'living', name: 'Гостиная', household_id: 'h1', devices: ['sensor'] },
    { id: 'bath', name: 'Баня', household_id: 'h2', devices: [] },
  ],
  groups: [],
  devices: [
    { id: 'lamp', name: 'Лампа', type: 'devices.types.light', room: 'kitchen', capabilities: [onOff(true)] },
    { id: 'plug', name: 'Розетка', type: 'devices.types.socket', room: 'kitchen', capabilities: [onOff(false)] },
    { id: 'sensor', name: 'Датчик', type: 'devices.types.sensor', room: 'living', capabilities: [],
      properties: [prop('devices.properties.float', 'temperature', 21), prop('devices.properties.event', 'motion', 'detected')] },
  ],
  scenarios: [],
};

const withFloor = (): { config: ZoneConfig; floorId: string } => {
  const { config, id } = addZone(EMPTY_ZONE_CONFIG, { name: 'Erdgeschoss', householdId: 'h1' }, () => 'zone:eg');
  return { config: moveNode(moveNode(config, 'kitchen', id), 'living', id), floorId: id };
};

describe('buildZoneTree', () => {
  it('ohne Einrichtung liegen alle Räume des Hauses direkt unter dem Haus', () => {
    const tree = buildZoneTree(home, EMPTY_ZONE_CONFIG, 'h1');
    expect(tree.map(n => n.id)).toEqual(['kitchen', 'living']);
    expect(tree[0].kind).toBe('room');
    expect(tree[0].allDeviceIds).toEqual(['lamp', 'plug']);
  });

  it('eigene Zonen enthalten Räume und zählen deren Geräte mit', () => {
    const { config } = withFloor();
    const tree = buildZoneTree(home, config, 'h1');
    expect(tree.map(n => n.id)).toEqual(['zone:eg']);
    expect(tree[0].children.map(n => n.id)).toEqual(['kitchen', 'living']);
    expect(tree[0].allDeviceIds).toEqual(['lamp', 'plug', 'sensor']);
  });

  it('Zonen eines anderen Hauses erscheinen nicht', () => {
    const { config } = withFloor();
    expect(buildZoneTree(home, config, 'h2').map(n => n.id)).toEqual(['bath']);
  });

  it('verwaiste Einträge werden ignoriert', () => {
    const config: ZoneConfig = { ...EMPTY_ZONE_CONFIG, parents: { kitchen: 'zone:gibtsnicht' } };
    expect(buildZoneTree(home, config, 'h1').map(n => n.id)).toEqual(['kitchen', 'living']);
  });

  it('flattenTree liefert die Reihenfolge mit Tiefe', () => {
    const { config } = withFloor();
    expect(flattenTree(buildZoneTree(home, config, 'h1')).map(n => `${n.depth}:${n.id}`)).toEqual(['0:zone:eg', '1:kitchen', '1:living']);
  });
});

describe('Zonen bearbeiten', () => {
  it('verhindert Ringe beim Verschieben', () => {
    let { config } = addZone(EMPTY_ZONE_CONFIG, { name: 'A', householdId: 'h1' }, () => 'zone:a');
    ({ config } = addZone(config, { name: 'B', householdId: 'h1', parentId: 'zone:a' }, () => 'zone:b'));
    const ring = moveNode(config, 'zone:a', 'zone:b');
    expect(ring.parents['zone:a']).toBeUndefined();
    expect(moveNode(config, 'zone:a', 'zone:a').parents['zone:a']).toBeUndefined();
  });

  it('nach oben verschieben entfernt die Zuordnung', () => {
    const { config } = withFloor();
    expect(moveNode(config, 'kitchen', null).parents.kitchen).toBeUndefined();
  });

  it('löschen hängt die Kinder eine Ebene höher', () => {
    let { config, floorId } = withFloor();
    let outer: string;
    ({ config, id: outer } = addZone(config, { name: 'Haus', householdId: 'h1' }, () => 'zone:haus'));
    config = moveNode(config, floorId, outer);
    config = removeZone(config, floorId);
    expect(config.zones.map(z => z.id)).toEqual(['zone:haus']);
    expect(config.parents.kitchen).toBe('zone:haus');
  });

  it('umbenennen ändert nur die Zone', () => {
    const { config, floorId } = withFloor();
    expect(renameZone(config, floorId, ' EG ').zones[0].name).toBe('EG');
  });
});

describe('summarizeDevices', () => {
  it('zählt Licht und Steckdosen und erkennt Bewegung', () => {
    const summary = summarizeDevices(home.devices);
    expect(summary.lights).toEqual({ total: 1, on: 1 });
    expect(summary.sockets).toEqual({ total: 1, on: 0 });
    expect(summary.temperature).toBe(21);
    expect(summary.motion).toBe(true);
    expect(isZoneActive(summary)).toBe(true);
  });

  it('nicht erreichbare Geräte zählen nicht als an', () => {
    const summary = summarizeDevices([{ ...home.devices[0], unreachable: true }]);
    expect(summary.lights).toEqual({ total: 1, on: 0 });
    expect(summary.unreachable).toBe(1);
  });

  it('ohne Sensoren keine Temperatur und keine Aktivität', () => {
    const summary = summarizeDevices([home.devices[1]]);
    expect(summary.temperature).toBeNull();
    expect(isZoneActive(summary)).toBe(false);
  });
});
