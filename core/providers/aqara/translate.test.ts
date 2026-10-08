import { describe, expect, it } from 'vitest';
import { buildAqaraHome, modeActionsToResources, parseDeviceId, type AqaraSnapshot } from './translate';

// Beispielantworten im Format der Aqara Open API v3 (query.position.info, query.device.info,
// query.resource.value, query.scene.listByPositionId)
const snapshot: AqaraSnapshot = {
  positions: [
    { positionId: 'real1.home', positionName: 'Дача', parentPositionId: '' },
    { positionId: 'real1.kitchen', positionName: 'Кухня', parentPositionId: 'real1.home' },
    { positionId: 'real1.bath', positionName: 'Баня', parentPositionId: 'real1.home' },
  ],
  devices: [
    { did: 'lumi.plug1', deviceName: 'Чайник-розетка', model: 'lumi.plug.maeu01', positionId: 'real1.kitchen', state: 1, modelType: 3 },
    { did: 'lumi.th1', deviceName: 'Климат', model: 'lumi.weather', positionId: 'real1.bath', state: 1, modelType: 3 },
    { did: 'lumi.door1', deviceName: 'Дверь', model: 'lumi.sensor_magnet.aq2', positionId: 'real1.home', state: 0, modelType: 3 },
    { did: 'lumi.sw2', deviceName: 'Выключатель', model: 'lumi.switch.b2laus01', positionId: 'real1.kitchen', state: 1, modelType: 3 },
    { did: 'lumi.light1', deviceName: 'Лампа', model: 'lumi.light.acn014', positionId: 'real1.kitchen', state: 1, modelType: 3 },
    { did: 'lumi.gw1', deviceName: 'Хаб', model: 'lumi.gateway.agl001', positionId: 'real1.home', state: 1, modelType: 1 },
  ],
  values: [
    { subjectId: 'lumi.plug1', resourceId: '4.1.85', value: '1' },
    { subjectId: 'lumi.plug1', resourceId: '0.12.85', value: '1830' },
    { subjectId: 'lumi.th1', resourceId: '0.1.85', value: '2350' },
    { subjectId: 'lumi.th1', resourceId: '0.2.85', value: '4512' },
    { subjectId: 'lumi.th1', resourceId: '8.0.2001', value: '87' },
    { subjectId: 'lumi.door1', resourceId: '3.1.85', value: '1' },
    { subjectId: 'lumi.sw2', resourceId: '4.1.85', value: '0' },
    { subjectId: 'lumi.sw2', resourceId: '4.2.85', value: '1' },
    { subjectId: 'lumi.light1', resourceId: '4.1.85', value: '1' },
    { subjectId: 'lumi.light1', resourceId: '14.1.85', value: '60' },
    { subjectId: 'lumi.light1', resourceId: '14.2.85', value: '250' },
  ],
  scenes: [{ sceneId: 'AL.1', name: 'Уходим', positionId: 'real1.home' }],
};

const home = buildAqaraHome(snapshot);
const device = (id: string) => home.devices.find(d => d.id === id)!;
const cap = (id: string, type: string) => device(id).capabilities.find(c => c.type === type);
const prop = (id: string, instance: string) => device(id).properties?.find(p => p.parameters?.instance === instance);

describe('buildAqaraHome', () => {
  it('oberste Positionen werden Häuser, darunter Räume, alles mit Präfix', () => {
    expect(home.households).toEqual([{ id: 'aqara:real1.home', name: 'Дача' }]);
    expect(home.rooms.map(r => r.id)).toEqual(['aqara:real1.kitchen', 'aqara:real1.bath']);
    expect(home.rooms[0].household_id).toBe('aqara:real1.home');
  });

  it('Steckdose: an/aus und Leistung', () => {
    expect(device('aqara:lumi.plug1').type).toBe('devices.types.socket');
    expect(cap('aqara:lumi.plug1', 'devices.capabilities.on_off')?.state?.value).toBe(true);
    expect(prop('aqara:lumi.plug1', 'power')?.state?.value).toBe(18.3);
  });

  it('Klimasensor: Temperatur, Luftfeuchte, Batterie in richtigen Einheiten', () => {
    expect(device('aqara:lumi.th1').type).toBe('devices.types.sensor.climate');
    expect(prop('aqara:lumi.th1', 'temperature')?.state?.value).toBe(23.5);
    expect(prop('aqara:lumi.th1', 'humidity')?.state?.value).toBe(45.12);
    expect(prop('aqara:lumi.th1', 'battery_level')?.state?.value).toBe(87);
  });

  it('Türsensor meldet offen und ist als offline markiert', () => {
    expect(prop('aqara:lumi.door1', 'open')?.state?.value).toBe('opened');
    expect(device('aqara:lumi.door1').unreachable).toBe(true);
    expect(device('aqara:lumi.door1').room).toBeUndefined();
    expect(device('aqara:lumi.door1').household_id).toBe('aqara:real1.home');
  });

  it('Doppelschalter wird zu zwei Geräten', () => {
    expect(cap('aqara:lumi.sw2', 'devices.capabilities.on_off')?.state?.value).toBe(false);
    expect(device('aqara:lumi.sw2#4.2.85').name).toBe('Выключатель 2');
    expect(cap('aqara:lumi.sw2#4.2.85', 'devices.capabilities.on_off')?.state?.value).toBe(true);
    expect(home.rooms[0].devices).toContain('aqara:lumi.sw2#4.2.85');
  });

  it('Lampe mit Helligkeit und Farbtemperatur', () => {
    expect(device('aqara:lumi.light1').type).toBe('devices.types.light');
    expect(cap('aqara:lumi.light1', 'devices.capabilities.range')?.state?.value).toBe(60);
    expect(cap('aqara:lumi.light1', 'devices.capabilities.color_setting')?.state?.value).toBe(4000);
  });

  it('Gateways werden nicht als Gerät angezeigt', () => {
    expect(home.devices.find(d => d.id === 'aqara:lumi.gw1')).toBeUndefined();
  });

  it('Szenen werden Szenarien', () => {
    expect(home.scenarios).toEqual([{ id: 'aqara:AL.1', name: 'Уходим', is_active: true }]);
  });

  it('ohne Positionen entsteht ein Haus „Aqara“', () => {
    const bare = buildAqaraHome({ ...snapshot, positions: [] });
    expect(bare.households[0].name).toBe('Aqara');
    expect(bare.devices.length).toBeGreaterThan(0);
  });
});

describe('Befehle', () => {
  it('Geräte-ID mit Kanal', () => {
    expect(parseDeviceId('lumi.sw2#4.2.85')).toEqual({ did: 'lumi.sw2', onOffResource: '4.2.85' });
    expect(parseDeviceId('lumi.plug1')).toEqual({ did: 'lumi.plug1', onOffResource: '4.1.85' });
  });

  it('Helligkeit und Farbtemperatur werden Aqara-Ressourcen', () => {
    expect(modeActionsToResources([
      { type: 'devices.capabilities.range', instance: 'brightness', value: 40 },
      { type: 'devices.capabilities.color_setting', instance: 'temperature_k', value: 2700 },
      { type: 'devices.capabilities.mode', instance: 'thermostat', value: 'heat' },
    ], '4.1.85', true)).toEqual([
      { resourceId: '4.1.85', value: '1' },
      { resourceId: '14.1.85', value: '40' },
      { resourceId: '14.2.85', value: '370' },
    ]);
  });
});
