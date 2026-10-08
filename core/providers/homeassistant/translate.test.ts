import { describe, expect, it } from 'vitest';
import { buildHomeAssistantHome, serviceForAction, serviceForToggle, type HaSnapshot } from './translate';

// Antworten im Format der Home-Assistant-REST-API (/api/states) und unseres Vorlagen-Abrufs
const snapshot: HaSnapshot = {
  locationName: 'Дача',
  areas: [{ id: 'kitchen', name: 'Кухня' }, { id: 'bedroom', name: 'Спальня' }],
  entities: [
    { e: 'switch.mi_plug', a: 'kitchen', d: 'dev-plug', dn: 'Mi Smart Plug' },
    { e: 'sensor.mi_plug_power', a: 'kitchen', d: 'dev-plug', dn: 'Mi Smart Plug' },
    { e: 'light.ceiling', a: 'bedroom', d: 'dev-light', dn: 'Потолок' },
    { e: 'sensor.th_temperature', a: 'bedroom', d: 'dev-th', dn: 'Термометр' },
    { e: 'sensor.th_humidity', a: 'bedroom', d: 'dev-th', dn: 'Термометр' },
    { e: 'sensor.th_battery', a: 'bedroom', d: 'dev-th', dn: 'Термометр' },
    { e: 'binary_sensor.door', a: null, d: 'dev-door', dn: 'Дверь' },
    { e: 'scene.movie', a: null, d: null, dn: null },
    { e: 'script.good_night', a: null, d: null, dn: null },
    { e: 'sun.sun', a: null, d: null, dn: null },
    { e: 'climate.ac', a: 'bedroom', d: 'dev-ac', dn: 'Кондиционер' },
  ],
  states: [
    { entity_id: 'switch.mi_plug', state: 'on', attributes: { friendly_name: 'Mi Smart Plug', device_class: 'outlet' } },
    { entity_id: 'sensor.mi_plug_power', state: '12.5', attributes: { device_class: 'power', unit_of_measurement: 'W' } },
    { entity_id: 'light.ceiling', state: 'off', attributes: { friendly_name: 'Потолок', brightness: 128, color_temp_kelvin: 3000, min_color_temp_kelvin: 2700, max_color_temp_kelvin: 6500, supported_color_modes: ['color_temp'] } },
    { entity_id: 'sensor.th_temperature', state: '21.4', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    { entity_id: 'sensor.th_humidity', state: '48', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
    { entity_id: 'sensor.th_battery', state: 'unavailable', attributes: { device_class: 'battery' } },
    { entity_id: 'binary_sensor.door', state: 'on', attributes: { friendly_name: 'Дверь', device_class: 'door' } },
    { entity_id: 'scene.movie', state: 'scening', attributes: { friendly_name: 'Кино' } },
    { entity_id: 'script.good_night', state: 'off', attributes: { friendly_name: 'Спокойной ночи' } },
    { entity_id: 'sun.sun', state: 'above_horizon', attributes: {} },
    { entity_id: 'climate.ac', state: 'unavailable', attributes: { friendly_name: 'Кондиционер', hvac_modes: ['off', 'cool', 'heat'] } },
  ],
};

const home = buildHomeAssistantHome(snapshot);
const device = (id: string) => home.devices.find(d => d.id === id)!;
const prop = (id: string, instance: string) => device(id).properties?.find(p => p.parameters?.instance === instance);

describe('buildHomeAssistantHome', () => {
  it('ein Haus, Bereiche werden Räume', () => {
    expect(home.households).toEqual([{ id: 'homeassistant:home', name: 'Дача' }]);
    expect(home.rooms.map(r => [r.id, r.name])).toEqual([['homeassistant:area.kitchen', 'Кухня'], ['homeassistant:area.bedroom', 'Спальня']]);
  });

  it('Steckdose mit Leistungssensor desselben Geräts als eine Karte', () => {
    const plug = device('homeassistant:switch.mi_plug');
    expect(plug.type).toBe('devices.types.socket');
    expect(plug.name).toBe('Mi Smart Plug');
    expect(plug.capabilities[0].state?.value).toBe(true);
    expect(prop('homeassistant:switch.mi_plug', 'power')?.state?.value).toBe(12.5);
    expect(home.devices.find(d => d.id === 'homeassistant:sensor.mi_plug_power')).toBeUndefined();
    expect(home.rooms[0].devices).toEqual(['homeassistant:switch.mi_plug']);
  });

  it('Lampe: Helligkeit in Prozent und Farbtemperatur', () => {
    const light = device('homeassistant:light.ceiling');
    expect(light.capabilities.find(c => c.type === 'devices.capabilities.range')?.state?.value).toBe(50);
    expect(light.capabilities.find(c => c.type === 'devices.capabilities.color_setting')?.state?.value).toBe(3000);
  });

  it('Gerät nur mit Sensoren wird eine Sensorkarte, nicht verfügbare Werte fehlen', () => {
    const th = device('homeassistant:device.dev-th');
    expect(th.type).toBe('devices.types.sensor.climate');
    expect(th.name).toBe('Термометр');
    expect(prop('homeassistant:device.dev-th', 'temperature')?.state?.value).toBe(21.4);
    expect(prop('homeassistant:device.dev-th', 'battery_level')).toBeUndefined();
  });

  it('Türkontakt ohne Raum: offen', () => {
    expect(prop('homeassistant:device.dev-door', 'open')?.state?.value).toBe('opened');
    expect(device('homeassistant:device.dev-door').room).toBeUndefined();
  });

  it('nicht verfügbares Gerät wird grau', () => {
    expect(device('homeassistant:climate.ac').unreachable).toBe(true);
  });

  it('Szenen und Skripte werden Szenarien, sonstige Einträge fehlen', () => {
    expect(home.scenarios.map(s => s.id)).toEqual(['homeassistant:scene.movie', 'homeassistant:script.good_night']);
    expect(home.devices.find(d => d.id.includes('sun'))).toBeUndefined();
  });
});

describe('Befehle', () => {
  it('Ein- und Ausschalten je Bereich', () => {
    expect(serviceForToggle('light.ceiling', true)).toEqual({ domain: 'light', service: 'turn_on', data: { entity_id: 'light.ceiling' } });
    expect(serviceForToggle('cover.blind', false)).toEqual({ domain: 'cover', service: 'close_cover', data: { entity_id: 'cover.blind' } });
    expect(serviceForToggle('scene.movie', true)).toEqual({ domain: 'scene', service: 'turn_on', data: { entity_id: 'scene.movie' } });
  });

  it('Einstellungen aus den Fenstern', () => {
    expect(serviceForAction('light.ceiling', { type: 'devices.capabilities.range', instance: 'brightness', value: 40 }))
      .toEqual({ domain: 'light', service: 'turn_on', data: { entity_id: 'light.ceiling', brightness_pct: 40 } });
    expect(serviceForAction('light.ceiling', { type: 'devices.capabilities.color_setting', instance: 'temperature_k', value: 4000 }))
      .toEqual({ domain: 'light', service: 'turn_on', data: { entity_id: 'light.ceiling', color_temp_kelvin: 4000 } });
    expect(serviceForAction('climate.ac', { type: 'devices.capabilities.mode', instance: 'thermostat', value: 'cool' }))
      .toEqual({ domain: 'climate', service: 'set_hvac_mode', data: { entity_id: 'climate.ac', hvac_mode: 'cool' } });
    expect(serviceForAction('climate.ac', { type: 'devices.capabilities.range', instance: 'temperature', value: 22 }))
      .toEqual({ domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.ac', temperature: 22 } });
    expect(serviceForAction('switch.x', { type: 'devices.capabilities.mode', instance: 'fan_speed', value: 'high' })).toBeNull();
  });
});
