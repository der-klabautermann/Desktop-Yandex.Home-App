import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_HOLD_MS, EMPTY_ZONE_CONFIG, addZone, buildZoneTree, categoryOf, flattenTree, isZoneActive, moveNode, removeZone, renameZone,
  searchDevices, summarizeDevices, zoneCategories, applyDeviceOverrides, setDeviceName, setDeviceRoom,
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

import { guessRoomIcon, setZoneIcon } from './zones';

describe('Symbole für Räume', () => {
  it('erraten das Symbol aus dem Namen in drei Sprachen', () => {
    expect(guessRoomIcon('Кухня')).toBe('kitchen');
    expect(guessRoomIcon('Wohnzimmer')).toBe('living');
    expect(guessRoomIcon('Master Bedroom')).toBe('bedroom');
    expect(guessRoomIcon('Ванная')).toBe('bath');
    expect(guessRoomIcon('Abstellraum')).toBeUndefined();
  });

  it('Räume bekommen ohne Einrichtung das erratene Symbol', () => {
    expect(buildZoneTree(home, EMPTY_ZONE_CONFIG, 'h1')[0].icon).toBe('kitchen');
  });

  it('auch Räume aus Diensten lassen sich umstellen', () => {
    const config = setZoneIcon(EMPTY_ZONE_CONFIG, 'kitchen', 'balcony');
    expect(buildZoneTree(home, config, 'h1')[0].icon).toBe('balcony');
    expect(config.zones).toEqual([]);
  });

  it('eigene Zonen speichern das Symbol an der Zone', () => {
    const { config, id } = addZone(EMPTY_ZONE_CONFIG, { name: 'EG', householdId: 'h1' }, () => 'zone:eg');
    expect(setZoneIcon(config, id, 'garden').zones[0].icon).toBe('garden');
  });
});

describe('Energie und Aktivität mit Nachlauf', () => {
  const now = 1_800_000_000_000;
  const motion = (value: string, secondsAgo: number | null) => ({
    ...prop('devices.properties.event', 'motion', value),
    last_updated: secondsAgo === null ? 0 : (now - secondsAgo * 1000) / 1000,
  });
  const sensor = (property: any) => ({ id: 's', name: 'S', type: 'devices.types.sensor.motion', capabilities: [], properties: [property] }) as any;

  it('summiert die Leistung aller messenden Geräte', () => {
    const devices = [
      { ...home.devices[0], properties: [prop('devices.properties.float', 'power', 4.4)] },
      { ...home.devices[1], properties: [prop('devices.properties.float', 'power', 3.9)] },
    ] as any;
    expect(summarizeDevices(devices).power).toBe(8.3);
    expect(summarizeDevices([home.devices[1]]).power).toBeNull();
  });

  it('bleibt nach Ende der Bewegung noch einige Minuten aktiv', () => {
    const recent = summarizeDevices([sensor(motion('not_detected', 120))], now);
    expect(recent.motion).toBe(false);
    expect(isZoneActive(recent, now)).toBe(true);
    const old = summarizeDevices([sensor(motion('not_detected', ACTIVITY_HOLD_MS / 1000 + 60))], now);
    expect(isZoneActive(old, now)).toBe(false);
  });

  it('altes „Bewegung erkannt“ zählt nicht mehr als aktuelle Bewegung', () => {
    const stale = summarizeDevices([sensor(motion('detected', 3600))], now);
    expect(stale.motion).toBe(false);
    expect(isZoneActive(stale, now)).toBe(false);
    expect(summarizeDevices([sensor(motion('detected', null))], now).motion).toBe(true);
  });
});

describe('Kategorien der Zonen-Steuerung', () => {
  const device = (id: string, type: string, on: boolean | null, extra: object = {}) =>
    ({ id, name: id, type, capabilities: on === null ? [] : [onOff(on)], ...extra }) as any;

  it('ordnet nur schaltbare Geräte einer Kategorie zu', () => {
    expect(categoryOf(device('a', 'devices.types.light.ceiling', true))).toBe('light');
    expect(categoryOf(device('b', 'devices.types.thermostat.ac', false))).toBe('climate');
    expect(categoryOf(device('c', 'devices.types.openable.curtain', false))).toBe('openable');
    expect(categoryOf(device('d', 'devices.types.smart_speaker.yandex.station_2', null))).toBeNull();
    expect(categoryOf(device('e', 'devices.types.sensor', null))).toBeNull();
  });

  it('zählt An/Gesamt in fester Reihenfolge, nicht erreichbare gelten als aus', () => {
    const categories = zoneCategories([
      device('ac', 'devices.types.thermostat.ac', true),
      device('l1', 'devices.types.light', true),
      device('l2', 'devices.types.light', true, { unreachable: true }),
      device('p', 'devices.types.socket', false),
    ]);
    expect(categories.map(c => c.key)).toEqual(['light', 'socket', 'climate']);
    expect(categories[0]).toMatchObject({ on: 1, total: 2, deviceIds: ['l1', 'l2'] });
  });
});

describe('Suche nach Gerät, Raum oder Zone', () => {
  const { config } = withFloor();
  const tree = buildZoneTree(home, config, 'h1');

  it('findet über Gerätename, Raumname und Zonenname', () => {
    expect([...searchDevices(home.devices, tree, 'ламп')]).toEqual(['lamp']);
    expect([...searchDevices(home.devices, tree, 'кухня')]).toEqual(['lamp', 'plug']);
    expect([...searchDevices(home.devices, tree, 'erdge')]).toEqual(['lamp', 'plug', 'sensor']);
  });

  it('ignoriert Groß- und Kleinschreibung und findet sonst nichts', () => {
    expect(searchDevices(home.devices, tree, 'ГОСТИН').has('sensor')).toBe(true);
    expect(searchDevices(home.devices, tree, 'garage').size).toBe(0);
  });
});

describe('Eigene Namen und Räume für Geräte', () => {
  it('benennt um und verschiebt in einen anderen Raum', () => {
    let config = setDeviceName(EMPTY_ZONE_CONFIG, 'lamp', ' Deckenlicht ');
    config = setDeviceRoom(config, 'lamp', 'living');
    const result = applyDeviceOverrides(home, config);
    const lamp = result.devices.find(d => d.id === 'lamp')!;
    expect(lamp.name).toBe('Deckenlicht');
    expect(lamp.room).toBe('living');
    expect(result.rooms.find(r => r.id === 'kitchen')!.devices).toEqual(['plug']);
    expect(result.rooms.find(r => r.id === 'living')!.devices).toEqual(['sensor', 'lamp']);
    // Original bleibt unverändert
    expect(home.devices.find(d => d.id === 'lamp')!.name).toBe('Лампа');
  });

  it('ein Gerät kann direkt in einer eigenen Zone liegen', () => {
    const { config: withZone, id } = addZone(EMPTY_ZONE_CONFIG, { name: 'Garten', householdId: 'h1' }, () => 'zone:garten');
    const config = setDeviceRoom(withZone, 'plug', id);
    const tree = buildZoneTree(applyDeviceOverrides(home, config), config, 'h1');
    const garden = tree.find(n => n.id === 'zone:garten')!;
    expect(garden.deviceIds).toEqual(['plug']);
    expect(tree.find(n => n.id === 'kitchen')!.deviceIds).toEqual(['lamp']);
  });

  it('leerer Name und null-Raum stellen den Stand des Dienstes wieder her', () => {
    let config = setDeviceRoom(setDeviceName(EMPTY_ZONE_CONFIG, 'lamp', 'X'), 'lamp', 'living');
    config = setDeviceRoom(setDeviceName(config, 'lamp', ''), 'lamp', null);
    expect(config.devices).toEqual({});
    expect(applyDeviceOverrides(home, config)).toBe(home);
  });

  it('Zone löschen gibt ihre Geräte an die Räume des Dienstes zurück', () => {
    const { config: withZone, id } = addZone(EMPTY_ZONE_CONFIG, { name: 'Garten', householdId: 'h1' }, () => 'zone:garten');
    const config = removeZone(setDeviceRoom(withZone, 'plug', id), id);
    expect(config.devices).toEqual({});
  });
});

describe('Symbol aus dem Raumnamen', () => {
  it('nimmt den genauesten Begriff', () => {
    expect(guessRoomIcon('Waschküche')).toBe('laundry');
    expect(guessRoomIcon('Küche')).toBe('kitchen');
    expect(guessRoomIcon('Garten hinten')).toBe('garden');
    expect(guessRoomIcon('Abstellkammer')).toBeUndefined();
  });
});
