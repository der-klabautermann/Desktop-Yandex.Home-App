// Перевод сущностей Home Assistant в общий формат (формат Яндекс Умного дома).
// Сущности одного физического устройства собираются в одну карточку.
import type { YandexCapability, YandexDevice, YandexModeAction, YandexProperty } from '../../../src/types/index';
import { withPrefix } from '../../ids';
import type { HomeData } from '../../model';

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
}

/** Строка из нашего шаблона: сущность, её зона (area), устройство и его имя. */
export interface HaEntityLink { e: string; a: string | null; d: string | null; dn: string | null }

export interface HaSnapshot {
  locationName: string;
  areas: Array<{ id: string; name: string }>;
  entities: HaEntityLink[];
  states: HaState[];
}

const id = (raw: string) => withPrefix('homeassistant', raw);
const domainOf = (entityId: string) => entityId.split('.')[0];

/** Управляемые области в порядке важности: первая становится главной на карточке устройства. */
const CONTROLLABLE = ['light', 'switch', 'fan', 'climate', 'cover', 'input_boolean', 'humidifier'];
const SENSORS = ['sensor', 'binary_sensor'];
const UNAVAILABLE = new Set(['unavailable', 'unknown']);

const onOff = (value: boolean): YandexCapability => ({
  type: 'devices.capabilities.on_off', retrievable: true, reportable: true, state: { instance: 'on', value },
});

const floatProperty = (instance: string, value: number, unit: string): YandexProperty => ({
  type: 'devices.properties.float', retrievable: true, reportable: true, parameters: { instance, unit }, state: { instance, value },
});

const eventProperty = (instance: string, value: string, events: string[]): YandexProperty => ({
  type: 'devices.properties.event', retrievable: true, reportable: true,
  parameters: { instance, events: events.map(v => ({ value: v, name: v })) }, state: { instance, value },
});

// Класс датчика HA -> показатель и единица в формате Яндекса
const FLOAT_SENSORS: Record<string, { instance: string; unit: string }> = {
  temperature: { instance: 'temperature', unit: 'unit.temperature.celsius' },
  humidity: { instance: 'humidity', unit: 'unit.percent' },
  battery: { instance: 'battery_level', unit: 'unit.percent' },
  illuminance: { instance: 'illumination', unit: 'unit.illumination.lux' },
  power: { instance: 'power', unit: 'unit.watt' },
  energy: { instance: 'amperage_energy', unit: 'unit.kilowatt_hour' },
  voltage: { instance: 'voltage', unit: 'unit.volt' },
  current: { instance: 'amperage', unit: 'unit.ampere' },
  carbon_dioxide: { instance: 'co2_level', unit: 'unit.ppm' },
  pm25: { instance: 'pm2_5_density', unit: 'unit.density.mcg_m3' },
  pm10: { instance: 'pm10_density', unit: 'unit.density.mcg_m3' },
};

const BINARY_SENSORS: Record<string, { instance: string; on: string; off: string }> = {
  motion: { instance: 'motion', on: 'detected', off: 'not_detected' },
  occupancy: { instance: 'motion', on: 'detected', off: 'not_detected' },
  presence: { instance: 'motion', on: 'detected', off: 'not_detected' },
  door: { instance: 'open', on: 'opened', off: 'closed' },
  window: { instance: 'open', on: 'opened', off: 'closed' },
  opening: { instance: 'open', on: 'opened', off: 'closed' },
  garage_door: { instance: 'open', on: 'opened', off: 'closed' },
  moisture: { instance: 'water_leak', on: 'leak', off: 'dry' },
  smoke: { instance: 'smoke', on: 'detected', off: 'not_detected' },
  gas: { instance: 'gas', on: 'detected', off: 'not_detected' },
};

const propertyFor = (state: HaState): YandexProperty | null => {
  if (UNAVAILABLE.has(state.state)) return null;
  const deviceClass = state.attributes.device_class as string | undefined;
  if (domainOf(state.entity_id) === 'sensor' && deviceClass && FLOAT_SENSORS[deviceClass]) {
    const value = Number(state.state);
    if (Number.isNaN(value)) return null;
    const { instance, unit } = FLOAT_SENSORS[deviceClass];
    // Энергию HA часто считает в Вт·ч: приводим к кВт·ч
    const scaled = deviceClass === 'energy' && state.attributes.unit_of_measurement === 'Wh' ? value / 1000 : value;
    return floatProperty(instance, Math.round(scaled * 100) / 100, unit);
  }
  if (domainOf(state.entity_id) === 'binary_sensor' && deviceClass && BINARY_SENSORS[deviceClass]) {
    const { instance, on, off } = BINARY_SENSORS[deviceClass];
    return eventProperty(instance, state.state === 'on' ? on : off, [on, off]);
  }
  return null;
};

/** Тип карточки по главной сущности или по набору датчиков. */
const typeFor = (main: HaState | null, properties: YandexProperty[]): string => {
  if (main) {
    const domain = domainOf(main.entity_id);
    if (domain === 'light') return 'devices.types.light';
    if (domain === 'switch') return main.attributes.device_class === 'outlet' ? 'devices.types.socket' : 'devices.types.switch';
    if (domain === 'input_boolean') return 'devices.types.switch';
    if (domain === 'fan') return 'devices.types.ventilation.fan';
    if (domain === 'humidifier') return 'devices.types.humidifier';
    if (domain === 'cover') return 'devices.types.openable.curtain';
    if (domain === 'climate') {
      const modes: string[] = main.attributes.hvac_modes ?? [];
      return modes.includes('cool') ? 'devices.types.thermostat.ac' : 'devices.types.thermostat';
    }
  }
  const instances = properties.map(p => p.parameters?.instance);
  if (instances.includes('motion')) return 'devices.types.sensor.motion';
  if (instances.includes('open')) return 'devices.types.sensor.open';
  if (instances.includes('water_leak')) return 'devices.types.sensor.water_leak';
  if (instances.includes('smoke') || instances.includes('gas')) return 'devices.types.sensor.smoke';
  if (instances.includes('temperature') || instances.includes('humidity')) return 'devices.types.sensor.climate';
  return 'devices.types.sensor';
};

const capabilitiesFor = (main: HaState): YandexCapability[] => {
  const domain = domainOf(main.entity_id);
  const isOn = domain === 'cover' ? main.state === 'open' : domain === 'climate' ? main.state !== 'off' : main.state === 'on';
  const result: YandexCapability[] = [onOff(isOn)];
  const a = main.attributes;
  if (domain === 'light' && (typeof a.brightness === 'number' || (a.supported_color_modes ?? []).some((m: string) => m !== 'onoff'))) {
    result.push({
      type: 'devices.capabilities.range', retrievable: true, reportable: true,
      parameters: { instance: 'brightness', unit: 'unit.percent', range: { min: 1, max: 100, precision: 1 } },
      state: { instance: 'brightness', value: typeof a.brightness === 'number' ? Math.round((a.brightness / 255) * 100) : 100 },
    });
  }
  if (domain === 'light' && (a.supported_color_modes ?? []).includes('color_temp')) {
    result.push({
      type: 'devices.capabilities.color_setting', retrievable: true, reportable: true,
      parameters: { temperature_k: { min: a.min_color_temp_kelvin ?? 2700, max: a.max_color_temp_kelvin ?? 6500, precision: 100 } },
      state: { instance: 'temperature_k', value: a.color_temp_kelvin ?? 4000 },
    });
  }
  if (domain === 'climate') {
    const modes: string[] = (a.hvac_modes ?? []).filter((m: string) => m !== 'off');
    if (modes.length > 0) {
      result.push({
        type: 'devices.capabilities.mode', retrievable: true, reportable: true,
        parameters: { instance: 'thermostat', modes: modes.map(m => ({ value: m, name: m })) },
        state: { instance: 'thermostat', value: main.state },
      });
    }
    if (typeof a.temperature === 'number') {
      result.push({
        type: 'devices.capabilities.range', retrievable: true, reportable: true,
        parameters: { instance: 'temperature', unit: 'unit.temperature.celsius', range: { min: a.min_temp ?? 16, max: a.max_temp ?? 30, precision: a.target_temp_step ?? 1 } },
        state: { instance: 'temperature', value: a.temperature },
      });
    }
  }
  return result;
};

export const buildHomeAssistantHome = (snapshot: HaSnapshot): HomeData => {
  const householdId = id('home');
  const states = new Map(snapshot.states.map(s => [s.entity_id, s]));
  const rooms = snapshot.areas.map(area => ({ id: id(`area.${area.id}`), name: area.name, household_id: householdId, devices: [] as string[] }));
  const devices: YandexDevice[] = [];
  const add = (device: YandexDevice) => {
    devices.push(device);
    rooms.find(r => r.id === device.room)?.devices.push(device.id);
  };

  // Группируем сущности по физическому устройству; без устройства каждая сама по себе
  const groups = new Map<string, HaEntityLink[]>();
  for (const link of snapshot.entities) {
    const domain = domainOf(link.e);
    if (!CONTROLLABLE.includes(domain) && !SENSORS.includes(domain)) continue;
    const key = link.d ?? `entity:${link.e}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(link);
  }

  for (const links of groups.values()) {
    const controllable = links.filter(l => CONTROLLABLE.includes(domainOf(l.e)))
      .sort((x, y) => CONTROLLABLE.indexOf(domainOf(x.e)) - CONTROLLABLE.indexOf(domainOf(y.e)));
    const properties = links.filter(l => SENSORS.includes(domainOf(l.e)))
      .map(l => states.get(l.e)).filter(Boolean).map(s => propertyFor(s!)).filter(Boolean) as YandexProperty[];
    const area = links.find(l => l.a)?.a ?? null;
    const deviceName = links[0].dn;

    if (controllable.length === 0) {
      if (properties.length === 0) continue;
      const first = states.get(links[0].e);
      add({
        id: id(links[0].d ? `device.${links[0].d}` : links[0].e),
        name: deviceName ?? first?.attributes.friendly_name ?? links[0].e,
        type: typeFor(null, properties),
        room: area ? id(`area.${area}`) : undefined,
        household_id: householdId,
        capabilities: [],
        properties,
      });
      continue;
    }

    controllable.forEach((link, index) => {
      const state = states.get(link.e);
      if (!state) return;
      add({
        id: id(link.e),
        // Главная сущность получает имя устройства, остальные — своё
        name: index === 0 && deviceName ? deviceName : state.attributes.friendly_name ?? link.e,
        type: typeFor(state, []),
        room: (link.a ?? area) ? id(`area.${link.a ?? area}`) : undefined,
        household_id: householdId,
        ...(UNAVAILABLE.has(state.state) ? { unreachable: true } : {}),
        capabilities: UNAVAILABLE.has(state.state) ? [onOff(false)] : capabilitiesFor(state),
        properties: index === 0 ? properties : [],
      });
    });
  }

  const scenarios = snapshot.states
    .filter(s => ['scene', 'script'].includes(domainOf(s.entity_id)))
    .map(s => ({ id: id(s.entity_id), name: s.attributes.friendly_name ?? s.entity_id, is_active: true }));

  return {
    status: 'ok',
    request_id: 'homeassistant',
    households: [{ id: householdId, name: snapshot.locationName || 'Home Assistant' }],
    rooms,
    groups: [],
    devices,
    scenarios,
  };
};

export interface HaServiceCall { domain: string; service: string; data: Record<string, unknown> }

export const serviceForToggle = (entityId: string, on: boolean): HaServiceCall => {
  const domain = domainOf(entityId);
  if (domain === 'cover') return { domain, service: on ? 'open_cover' : 'close_cover', data: { entity_id: entityId } };
  if (domain === 'scene' || domain === 'script') return { domain, service: 'turn_on', data: { entity_id: entityId } };
  return { domain, service: on ? 'turn_on' : 'turn_off', data: { entity_id: entityId } };
};

/** Действие из окна настроек; null — такую настройку HA для этой сущности не поддерживаем. */
export const serviceForAction = (entityId: string, action: YandexModeAction): HaServiceCall | null => {
  const domain = domainOf(entityId);
  if (domain === 'light' && action.instance === 'brightness') return { domain, service: 'turn_on', data: { entity_id: entityId, brightness_pct: Number(action.value) } };
  if (domain === 'light' && action.instance === 'temperature_k') return { domain, service: 'turn_on', data: { entity_id: entityId, color_temp_kelvin: Number(action.value) } };
  if (domain === 'light' && (action.instance === 'hsv' || action.instance === 'rgb') && typeof action.value === 'object') {
    const hsv = action.value as { h?: number; s?: number };
    if (typeof hsv.h === 'number' && typeof hsv.s === 'number') return { domain, service: 'turn_on', data: { entity_id: entityId, hs_color: [hsv.h, hsv.s] } };
  }
  if (domain === 'climate' && action.instance === 'thermostat') return { domain, service: 'set_hvac_mode', data: { entity_id: entityId, hvac_mode: action.value } };
  if (domain === 'climate' && action.instance === 'temperature') return { domain, service: 'set_temperature', data: { entity_id: entityId, temperature: Number(action.value) } };
  if (action.instance === 'on') return serviceForToggle(entityId, Boolean(action.value));
  return null;
};
