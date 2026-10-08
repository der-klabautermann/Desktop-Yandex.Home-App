// Перевод ответов Aqara Open API в общий формат (формат Яндекс Умного дома).
// Идентификаторы ресурсов Aqara: <тип>.<канал>.<код>, например 4.1.85 — вкл/выкл первого канала.
import type { YandexCapability, YandexDevice, YandexModeAction, YandexProperty } from '../../../src/types/index';
import { withPrefix } from '../../ids';
import type { HomeData } from '../../model';

export interface AqaraPosition { positionId: string; positionName: string; parentPositionId?: string }
export interface AqaraDeviceInfo {
  did: string; deviceName: string; model: string; positionId: string;
  /** 0 — не в сети, 1 — в сети */
  state: number;
  /** 1, 2 — шлюзы, 3 — дочерние устройства */
  modelType?: number;
}
export interface AqaraResourceValue { subjectId: string; resourceId: string; value: string }
export interface AqaraScene { sceneId: string; name: string; positionId?: string }

export interface AqaraSnapshot {
  positions: AqaraPosition[];
  devices: AqaraDeviceInfo[];
  values: AqaraResourceValue[];
  scenes: AqaraScene[];
}

export const RES = {
  onOff: '4.1.85',
  brightness: '14.1.85',
  colorTemperature: '14.2.85',
  temperature: '0.1.85',
  humidity: '0.2.85',
  pressure: '0.3.85',
  illuminance: '0.4.85',
  power: '0.12.85',
  energy: '0.13.85',
  status: '3.1.85',
  battery: '8.0.2001',
  button: '13.1.85',
} as const;

const id = (raw: string) => withPrefix('aqara', raw);

/** Тип устройства по модели Aqara (lumi.<класс>.<вариант>). */
export const typeForModel = (model: string): string => {
  const m = model.toLowerCase();
  if (m.includes('.light.') || m.includes('.bulb')) return 'devices.types.light';
  if (m.includes('.plug') || m.includes('ctrl_86plug')) return 'devices.types.socket';
  if (m.includes('.switch.') || m.includes('ctrl_neutral') || m.includes('ctrl_ln')) return 'devices.types.switch';
  if (m.includes('.curtain') || m.includes('.blind')) return 'devices.types.openable.curtain';
  if (m.includes('airrtc') || m.includes('thermostat')) return 'devices.types.thermostat';
  if (m.includes('motion') || m.includes('.occupancy')) return 'devices.types.sensor.motion';
  if (m.includes('magnet')) return 'devices.types.sensor.open';
  if (m.includes('wleak') || m.includes('flood')) return 'devices.types.sensor.water_leak';
  if (m.includes('smoke')) return 'devices.types.sensor.smoke';
  if (m.includes('remote') || m.includes('sensor_switch')) return 'devices.types.sensor.button';
  if (m.includes('weather') || m.includes('sensor_ht') || m.includes('airmonitor')) return 'devices.types.sensor.climate';
  return 'devices.types.other';
};

const isGateway = (device: AqaraDeviceInfo) =>
  device.modelType === 1 || device.modelType === 2 || /gateway|\.hub|camera\.gw/.test(device.model);

const onOffCapability = (value: boolean): YandexCapability => ({
  type: 'devices.capabilities.on_off', retrievable: true, reportable: true, state: { instance: 'on', value },
});

const floatProperty = (instance: string, value: number, unit: string): YandexProperty => ({
  type: 'devices.properties.float', retrievable: true, reportable: true,
  parameters: { instance, unit }, state: { instance, value },
});

const eventProperty = (instance: string, value: string, events: string[]): YandexProperty => ({
  type: 'devices.properties.event', retrievable: true, reportable: true,
  parameters: { instance, events: events.map(v => ({ value: v, name: v })) }, state: { instance, value },
});

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const miredToKelvin = (mired: number) => Math.round(1_000_000 / mired / 100) * 100;
const kelvinToMired = (kelvin: number) => Math.round(1_000_000 / kelvin);

/** Свойства (датчики) из значений ресурсов. */
const propertiesFor = (type: string, values: Map<string, string>): YandexProperty[] => {
  const result: YandexProperty[] = [];
  const num = (resource: string) => (values.has(resource) ? Number(values.get(resource)) : NaN);

  if (!Number.isNaN(num(RES.temperature))) result.push(floatProperty('temperature', round(num(RES.temperature) / 100), 'unit.temperature.celsius'));
  if (!Number.isNaN(num(RES.humidity))) result.push(floatProperty('humidity', round(num(RES.humidity) / 100), 'unit.percent'));
  if (!Number.isNaN(num(RES.pressure))) result.push(floatProperty('pressure', round(num(RES.pressure) * 0.00750062, 1), 'unit.pressure.mmhg'));
  if (!Number.isNaN(num(RES.illuminance))) result.push(floatProperty('illumination', num(RES.illuminance), 'unit.illumination.lux'));
  if (!Number.isNaN(num(RES.power))) result.push(floatProperty('power', round(num(RES.power) / 100, 1), 'unit.watt'));
  if (!Number.isNaN(num(RES.energy))) result.push(floatProperty('amperage_energy', round(num(RES.energy) / 1000, 2), 'unit.kilowatt_hour'));
  if (!Number.isNaN(num(RES.battery))) result.push(floatProperty('battery_level', num(RES.battery), 'unit.percent'));

  const status = values.get(RES.status);
  if (status !== undefined) {
    const active = status === '1';
    if (type === 'devices.types.sensor.motion') result.push(eventProperty('motion', active ? 'detected' : 'not_detected', ['detected', 'not_detected']));
    if (type === 'devices.types.sensor.open') result.push(eventProperty('open', active ? 'opened' : 'closed', ['opened', 'closed']));
    if (type === 'devices.types.sensor.water_leak') result.push(eventProperty('water_leak', active ? 'leak' : 'dry', ['leak', 'dry']));
    if (type === 'devices.types.sensor.smoke') result.push(eventProperty('smoke', active ? 'detected' : 'not_detected', ['detected', 'not_detected']));
  }

  const button = values.get(RES.button);
  if (button !== undefined) {
    const event = { '1': 'click', '2': 'double_click', '16': 'long_press' }[button];
    if (event) result.push(eventProperty('button', event, ['click', 'double_click', 'long_press']));
  }
  return result;
};

export const buildAqaraHome = (snapshot: AqaraSnapshot): HomeData => {
  const byId = new Map(snapshot.positions.map(p => [p.positionId, p]));
  const topOf = (positionId: string): AqaraPosition | undefined => {
    let current = byId.get(positionId);
    const seen = new Set<string>();
    while (current?.parentPositionId && byId.has(current.parentPositionId) && !seen.has(current.positionId)) {
      seen.add(current.positionId);
      current = byId.get(current.parentPositionId);
    }
    return current;
  };

  const homes = snapshot.positions.filter(p => !p.parentPositionId || !byId.has(p.parentPositionId));
  const fallbackHome = homes.length === 0 ? { positionId: 'home', positionName: 'Aqara' } : null;
  const households = (fallbackHome ? [fallbackHome] : homes).map(p => ({ id: id(p.positionId), name: p.positionName }));
  const homeIdFor = (positionId: string) => id(topOf(positionId)?.positionId ?? (fallbackHome ?? homes[0]).positionId);

  const rooms = snapshot.positions
    .filter(p => !homes.includes(p))
    .map(p => ({ id: id(p.positionId), name: p.positionName, household_id: homeIdFor(p.positionId), devices: [] as string[] }));
  const roomById = new Map(rooms.map(r => [r.id, r]));

  const valuesByDevice = new Map<string, Map<string, string>>();
  for (const v of snapshot.values) {
    if (!valuesByDevice.has(v.subjectId)) valuesByDevice.set(v.subjectId, new Map());
    valuesByDevice.get(v.subjectId)!.set(v.resourceId, v.value);
  }

  const devices: YandexDevice[] = [];
  for (const info of snapshot.devices) {
    if (isGateway(info)) continue;
    const values = valuesByDevice.get(info.did) ?? new Map<string, string>();
    const type = typeForModel(info.model);
    const room = roomById.get(id(info.positionId));
    const base = {
      type,
      room: room?.id,
      household_id: homeIdFor(info.positionId),
      ...(info.state === 0 ? { unreachable: true } : {}),
    };

    // Каждый канал вкл/выкл (4.1.85, 4.2.85, …) — отдельная карточка
    const channels = [...values.keys()].filter(r => /^4\.\d+\.85$/.test(r)).sort();
    const first = channels[0] ?? null;

    const capabilities: YandexCapability[] = [];
    if (first) capabilities.push(onOffCapability(values.get(first) === '1'));
    if (values.has(RES.brightness)) {
      capabilities.push({
        type: 'devices.capabilities.range', retrievable: true, reportable: true,
        parameters: { instance: 'brightness', unit: 'unit.percent', range: { min: 1, max: 100, precision: 1 } },
        state: { instance: 'brightness', value: Number(values.get(RES.brightness)) },
      });
    }
    if (values.has(RES.colorTemperature)) {
      capabilities.push({
        type: 'devices.capabilities.color_setting', retrievable: true, reportable: true,
        parameters: { temperature_k: { min: 2700, max: 6500, precision: 100 } },
        state: { instance: 'temperature_k', value: miredToKelvin(Number(values.get(RES.colorTemperature))) },
      });
    }

    const mainId = id(info.did);
    devices.push({ id: mainId, name: info.deviceName, ...base, capabilities, properties: propertiesFor(type, values) });
    room?.devices.push(mainId);

    for (const [index, channel] of channels.slice(1).entries()) {
      const channelId = id(`${info.did}#${channel}`);
      devices.push({
        id: channelId, name: `${info.deviceName} ${index + 2}`, ...base,
        capabilities: [onOffCapability(values.get(channel) === '1')], properties: [],
      });
      room?.devices.push(channelId);
    }
  }

  return {
    status: 'ok',
    request_id: 'aqara',
    households,
    rooms,
    groups: [],
    devices,
    scenarios: snapshot.scenes.map(s => ({ id: id(s.sceneId), name: s.name, is_active: true })),
  };
};

/** Разбирает ID карточки: устройство и ресурс вкл/выкл (для многоканальных выключателей). */
export const parseDeviceId = (deviceId: string): { did: string; onOffResource: string } => {
  const [did, channel] = deviceId.split('#');
  return { did, onOffResource: channel ?? RES.onOff };
};

/** Действия из окон настроек переводятся в ресурсы Aqara; неизвестные пропускаются. */
export const modeActionsToResources = (
  actions: YandexModeAction[], onOffResource: string, turnOn: boolean,
): Array<{ resourceId: string; value: string }> => {
  const result: Array<{ resourceId: string; value: string }> = [];
  if (turnOn) result.push({ resourceId: onOffResource, value: '1' });
  for (const action of actions) {
    if (action.instance === 'on') result.push({ resourceId: onOffResource, value: action.value ? '1' : '0' });
    if (action.instance === 'brightness') result.push({ resourceId: RES.brightness, value: String(Math.round(Number(action.value))) });
    if (action.instance === 'temperature_k') result.push({ resourceId: RES.colorTemperature, value: String(kelvinToMired(Number(action.value))) });
  }
  return result;
};
