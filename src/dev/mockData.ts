// Демо-данные для предпросмотра в браузере (npm run preview:web). В сборку приложения не попадают.
import type { YandexDevice, YandexUserInfoResponse } from '../types';

const onOff = (value: boolean) => ({
  type: 'devices.capabilities.on_off', retrievable: true, reportable: true,
  state: { instance: 'on', value },
});

const brightness = (value: number) => ({
  type: 'devices.capabilities.range', retrievable: true, reportable: true,
  parameters: { instance: 'brightness', unit: 'unit.percent', range: { min: 1, max: 100, precision: 1 } },
  state: { instance: 'brightness', value },
});

const float = (instance: string, value: number, unit: string) => ({
  type: 'devices.properties.float', retrievable: true, reportable: true,
  parameters: { instance, unit },
  state: { instance, value },
});

const event = (instance: string, value: string, events: Array<{ value: string; name: string }>) => ({
  type: 'devices.properties.event', retrievable: true, reportable: true,
  parameters: { instance, events },
  state: { instance, value },
});

const thermostatModes = {
  type: 'devices.capabilities.mode', retrievable: true, reportable: true,
  parameters: { instance: 'thermostat', modes: [{ value: 'auto', name: 'Авто' }, { value: 'heat', name: 'Нагрев' }, { value: 'cool', name: 'Охлаждение' }] },
  state: { instance: 'thermostat', value: 'heat' },
};

export const createMockHome = (): YandexUserInfoResponse => {
  const devices: YandexDevice[] = [
    { id: 'lamp-living', name: 'Люстра', type: 'devices.types.light', room: 'room-living', capabilities: [onOff(true), brightness(70)] },
    { id: 'lamp-floor', name: 'Торшер', type: 'devices.types.light', room: 'room-living', capabilities: [onOff(false), brightness(40)] },
    { id: 'tv-plug', name: 'Розетка ТВ', type: 'devices.types.socket', room: 'room-living', capabilities: [onOff(true)] },
    { id: 'ac', name: 'Кондиционер', type: 'devices.types.thermostat.ac', room: 'room-bedroom', capabilities: [onOff(false), thermostatModes] },
    { id: 'lamp-bed', name: 'Ночник', type: 'devices.types.light', room: 'room-bedroom', capabilities: [onOff(false), brightness(20)] },
    {
      id: 'climate', name: 'Датчик климата', type: 'devices.types.sensor.climate', room: 'room-bedroom', capabilities: [],
      properties: [float('temperature', 22.4, 'unit.temperature.celsius'), float('humidity', 46, 'unit.percent'), float('pressure', 748, 'unit.pressure.mmhg')] as any,
    },
    {
      id: 'door', name: 'Входная дверь', type: 'devices.types.sensor.open', room: 'room-hall', capabilities: [],
      properties: [event('open', 'closed', [{ value: 'opened', name: 'открыто' }, { value: 'closed', name: 'закрыто' }])] as any,
    },
    { id: 'kettle', name: 'Чайник', type: 'devices.types.cooking.kettle', room: 'room-kitchen', capabilities: [onOff(false)] },
  ];
  return {
    status: 'ok',
    request_id: 'mock',
    devices,
    households: [{ id: 'home-1', name: 'Дом' }],
    rooms: [
      { id: 'room-living', name: 'Гостиная', household_id: 'home-1', devices: ['lamp-living', 'lamp-floor', 'tv-plug'] },
      { id: 'room-bedroom', name: 'Спальня', household_id: 'home-1', devices: ['ac', 'lamp-bed', 'climate'] },
      { id: 'room-hall', name: 'Прихожая', household_id: 'home-1', devices: ['door'] },
      { id: 'room-kitchen', name: 'Кухня', household_id: 'home-1', devices: ['kettle'] },
    ],
    groups: [
      { id: 'group-lights', name: 'Весь свет', household_id: 'home-1', devices: ['lamp-living', 'lamp-floor', 'lamp-bed'], capabilities: [onOff(true)] },
    ],
    scenarios: [
      { id: 'sc-night', name: 'Спокойной ночи', is_active: true },
      { id: 'sc-morning', name: 'Доброе утро', is_active: true },
    ],
  };
};
