// Показания и состояние устройства в читаемом виде: для карточек, окна устройства и настроек датчика.
import React from 'react';
import {
  AirVent, AlarmSmoke, BatteryFull, CircleDot, Coffee, Droplet, Droplets, DoorOpen, Fan, Flame, Footprints, Gauge,
  Lightbulb, Lock, MousePointerClick, MoveHorizontal, Package, Palette, Pause, Sparkles, Sun,
  Thermometer, Tv, Vibrate, Volume2, VolumeX, Waves, Wind, Zap,
} from 'lucide-react';
import type { YandexDevice } from '../types/index';
import type { Translate } from '../i18n/core';
import { localizeEvent, localizeMode, localizeUnit } from '../constants/formatting';

const INSTANCE_ICONS: Record<string, React.ElementType> = {
  // Показания
  temperature: Thermometer, humidity: Droplets, illumination: Sun, pressure: Gauge,
  co2_level: Wind, pm1_density: Wind, 'pm2.5_density': Wind, pm2_5_density: Wind, pm10_density: Wind, tvoc: Wind,
  battery_level: BatteryFull, water_level: Waves, food_level: Package,
  motion: Footprints, open: DoorOpen, smoke: AlarmSmoke, gas: Flame, vibration: Vibrate, water_leak: Droplet,
  button: MousePointerClick,
  power: Zap, voltage: Zap, amperage: Zap,
  electricity_meter: Zap, gas_meter: Flame, water_meter: Waves, heat_meter: Thermometer, meter: Gauge,
  // Умения
  brightness: Sun, temperature_k: Lightbulb, hsv: Palette, rgb: Palette, scene: Palette,
  volume: Volume2, channel: Tv, mute: VolumeX, pause: Pause,
  keep_warm: Flame, backlight: Lightbulb, ionization: Sparkles, oscillation: MoveHorizontal, controls_locked: Lock,
  thermostat: AirVent, fan_speed: Fan, swing: MoveHorizontal, coffee_mode: Coffee, tea_mode: Coffee,
  heat: Flame,
};

export const InstanceIcon: React.FC<{ instance: string; className?: string }> = ({ instance, className = 'w-4 h-4' }) => {
  const Icon = INSTANCE_ICONS[instance] ?? CircleDot;
  return <Icon className={className} />;
};

const lookup = (t: Translate, key: string, fallback: string) => {
  const text = t(key);
  return text === key ? fallback : text;
};

/** Название показания (температура, мощность …); точка в pm2.5 недопустима в ключах словаря. */
export const propertyLabel = (instance: string, t: Translate) =>
  lookup(t, `sensors.${instance.replace(/\./g, '_')}`, instance);

/** Название умения устройства (яркость, громкость, программа …). */
export const capabilityLabel = (instance: string, t: Translate) => lookup(t, `capabilityNames.${instance}`, instance);

const formatNumber = (value: number, lang: string) => value.toLocaleString(lang, { maximumFractionDigits: 2 });

const UNIT_FALLBACK: Record<string, string> = { humidity: ' %', temperature: ' °C' };

export interface PropertyRow {
  /** Индекс в device.properties: по нему сохраняется выбор для карточки датчика. */
  index: number;
  instance: string;
  type: string;
  value: string;
  /** Время последнего обновления (мс), null: сервис не сообщил. */
  at: number | null;
}

export const formatPropertyValue = (property: any, t: Translate, lang: string): string => {
  const instance: string = property?.parameters?.instance ?? property?.state?.instance ?? '';
  const raw = property?.state?.value;
  if (property?.type === 'devices.properties.event' && typeof raw === 'string') {
    return localizeEvent(raw, property?.parameters?.events, t);
  }
  if (typeof raw === 'number') {
    const unit = localizeUnit(property?.parameters?.unit ?? property?.state?.unit, t) || UNIT_FALLBACK[instance] || '';
    return `${formatNumber(raw, lang)}${unit}`;
  }
  if (typeof raw === 'boolean') return raw ? t('cards.on') : t('cards.off');
  return String(raw ?? '–');
};

export const listProperties = (device: YandexDevice, t: Translate, lang: string): PropertyRow[] =>
  (device.properties ?? []).flatMap((property: any, index) => {
    const instance: string | undefined = property?.parameters?.instance ?? property?.state?.instance;
    if (typeof property?.type !== 'string' || !instance || property?.state?.value === undefined) return [];
    const at = typeof property.last_updated === 'number' && property.last_updated > 0 ? property.last_updated * 1000 : null;
    return [{ index, instance, type: property.type, value: formatPropertyValue(property, t, lang), at }];
  });

export interface StateRow {
  instance: string;
  value: string;
  /** Цвет для кружка рядом со значением (только для цвета света). */
  swatch?: string;
}

const hsvToCss = (hsv: { h: number; s: number; v: number }) =>
  `hsl(${hsv.h} ${Math.round(hsv.s)}% ${Math.max(25, Math.round(hsv.v / 2 + 25))}%)`;

/** Текущее состояние умений кроме включения: яркость, режимы, громкость и т. п. */
export const listStates = (device: YandexDevice, t: Translate, lang: string): StateRow[] =>
  device.capabilities.flatMap((capability: any): StateRow[] => {
    const state = capability.state;
    if (!state || capability.type === 'devices.capabilities.on_off' || capability.type === 'devices.capabilities.video_stream') return [];
    const instance: string = state.instance ?? capability.parameters?.instance;
    const value = state.value;
    switch (capability.type) {
      case 'devices.capabilities.range': {
        const unit = localizeUnit(capability.parameters?.unit, t);
        return [{ instance, value: `${formatNumber(Number(value), lang)}${unit}` }];
      }
      case 'devices.capabilities.mode':
        return [{ instance, value: localizeMode(String(value), capability.parameters?.modes?.find((m: any) => m.value === value)?.name, t) }];
      case 'devices.capabilities.toggle':
        return [{ instance, value: value ? t('cards.on') : t('cards.off') }];
      case 'devices.capabilities.color_setting':
        if (instance === 'temperature_k') return [{ instance, value: `${formatNumber(Number(value), lang)} K` }];
        if (instance === 'hsv' && value && typeof value === 'object') {
          return [{ instance: 'hsv', value: '', swatch: hsvToCss(value as any) }];
        }
        if (instance === 'rgb' && typeof value === 'number') {
          return [{ instance: 'rgb', value: '', swatch: `#${value.toString(16).padStart(6, '0')}` }];
        }
        return [];
      default:
        return [];
    }
  });

/** Время показания: сегодня только часы, иначе дата и время. */
export const formatAt = (at: number, lang: string) => {
  const date = new Date(at);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(lang, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
};


// Название типа устройства: сначала точные подтипы, потом общие классы (ключи словаря deviceTypes)
const TYPE_KEYS: Array<[string, string]> = [
  ['light', 'light'], ['socket', 'socket'], ['switch', 'switch'],
  ['thermostat.ac', 'ac'], ['thermostat', 'thermostat'],
  ['ventilation.fan', 'fan'], ['ventilation', 'ventilation'], ['humidifier', 'humidifier'], ['purifier', 'purifier'],
  ['media_device.tv_box', 'tvBox'], ['media_device.tv', 'tv'], ['media_device.receiver', 'receiver'], ['media_device', 'media'],
  ['smart_speaker', 'speaker'],
  ['cooking.kettle', 'kettle'], ['cooking.coffee_maker', 'coffeeMaker'], ['cooking.multicooker', 'multicooker'], ['cooking', 'cooking'],
  ['washing_machine', 'washingMachine'], ['dishwasher', 'dishwasher'], ['iron', 'iron'], ['vacuum_cleaner', 'vacuum'],
  ['openable.curtain', 'curtain'], ['openable.valve', 'valve'], ['openable', 'openable'],
  ['pet_feeder', 'petFeeder'], ['pet_drinking_fountain', 'petFountain'],
  ['sensor.motion', 'motionSensor'], ['sensor.open', 'openSensor'], ['sensor.water_leak', 'leakSensor'],
  ['sensor.smoke', 'smokeSensor'], ['sensor.gas', 'gasSensor'], ['sensor.button', 'button'],
  ['sensor.vibration', 'vibrationSensor'], ['sensor.illumination', 'lightSensor'], ['sensor.climate', 'climateSensor'],
  ['sensor', 'sensor'],
  ['smart_meter.electricity', 'electricityMeter'], ['smart_meter.gas', 'gasMeter'], ['smart_meter.heat', 'heatMeter'],
  ['smart_meter.cold_water', 'waterMeter'], ['smart_meter.hot_water', 'waterMeter'], ['smart_meter', 'meter'],
  ['camera', 'camera'], ['hub', 'hub'],
];

export const deviceTypeLabel = (type: string, t: Translate) => {
  const short = type.replace('devices.types.', '');
  const key = TYPE_KEYS.find(([prefix]) => short.startsWith(prefix))?.[1] ?? 'other';
  return lookup(t, `deviceTypes.${key}`, short);
};

// --- Внешний вид карточек: картинка и цвет значка по типу устройства ---

/** Категория задаёт цвет значка у включённого устройства. */
export type DeviceCategory = 'light' | 'climate' | 'water' | 'power' | 'security' | 'media' | 'kitchen' | 'appliance' | 'sensor';

const CATEGORY_RULES: Array<[string, DeviceCategory]> = [
  ['light', 'light'], ['sensor.illumination', 'light'],
  ['thermostat', 'climate'], ['ventilation', 'climate'], ['humidifier', 'climate'], ['purifier', 'climate'], ['sensor.climate', 'climate'],
  ['openable.valve', 'water'], ['sensor.water_leak', 'water'], ['smart_meter.cold_water', 'water'], ['smart_meter.hot_water', 'water'],
  ['pet_drinking_fountain', 'water'],
  ['socket', 'power'], ['switch', 'power'], ['smart_meter', 'power'], ['hub', 'power'], ['other', 'power'],
  ['sensor.open', 'security'], ['sensor.motion', 'sensor'], ['sensor.smoke', 'security'], ['sensor.gas', 'security'],
  ['camera', 'security'], ['openable', 'security'],
  ['media_device', 'media'], ['smart_speaker', 'media'],
  ['cooking', 'kitchen'], ['pet_feeder', 'kitchen'],
  ['washing_machine', 'appliance'], ['dishwasher', 'appliance'], ['iron', 'appliance'], ['vacuum_cleaner', 'appliance'],
];

export const deviceCategory = (type: string): DeviceCategory => {
  const short = type.replace('devices.types.', '');
  return CATEGORY_RULES.find(([prefix]) => short.startsWith(prefix))?.[1] ?? 'sensor';
};

// Картинка на карточке: ключ файла в public/device-art/<ключ>-day.webp и -night.webp
const ART_RULES: Array<[string, string]> = [
  ['light.ceiling', 'ceiling-light'], ['light.lamp', 'desk-lamp'], ['light.strip', 'light-strip'], ['light', 'bulb'],
  ['socket', 'socket'], ['switch', 'switch'],
  ['thermostat.ac', 'air-conditioner'], ['thermostat', 'radiator'],
  ['ventilation.fan', 'fan'], ['ventilation', 'bath-fan'], ['humidifier', 'humidifier'], ['purifier', 'purifier'],
  ['media_device.tv_box', 'tv-box'], ['media_device.receiver', 'receiver'], ['media_device', 'tv'], ['smart_speaker', 'speaker'],
  ['cooking.coffee_maker', 'coffee-maker'], ['cooking.kettle', 'kettle'], ['cooking', 'multicooker'],
  ['washing_machine', 'washing-machine'], ['dishwasher', 'dishwasher'], ['iron', 'iron'], ['vacuum_cleaner', 'robot-vacuum'],
  ['openable.curtain', 'curtains'], ['openable.valve', 'water-valve'], ['openable', 'blinds'],
  ['pet_feeder', 'pet-feeder'], ['pet_drinking_fountain', 'pet-fountain'],
  ['sensor.motion', 'motion-sensor'], ['sensor.open', 'door-sensor'], ['sensor.water_leak', 'leak-sensor'],
  ['sensor.smoke', 'smoke-detector'], ['sensor.gas', 'gas-detector'], ['sensor.button', 'button'],
  ['sensor.vibration', 'vibration-sensor'], ['sensor.illumination', 'light-sensor'], ['sensor', 'climate-sensor'],
  ['smart_meter', 'meter'], ['camera', 'camera'], ['hub', 'hub'], ['other', 'hub'],
];

/** Картинки, которые уже лежат в public/device-art (обе версии: день и ночь). */
export const AVAILABLE_ART = new Set<string>([
  'air-conditioner',
  'bath-fan',
  'blinds',
  'bulb',
  'button',
  'camera',
  'ceiling-light',
  'climate-sensor',
  'coffee-maker',
  'curtains',
  'desk-lamp',
  'dishwasher',
  'door-sensor',
  'fan',
  'gas-detector',
  'hub',
  'humidifier',
  'iron',
  'kettle',
  'leak-sensor',
  'light-sensor',
  'light-strip',
  'meter',
  'motion-sensor',
  'multicooker',
  'pet-feeder',
  'pet-fountain',
  'purifier',
  'radiator',
  'receiver',
  'robot-vacuum',
  'smoke-detector',
  'socket',
  'speaker',
  'switch',
  'tv',
  'tv-box',
  'vibration-sensor',
  'washing-machine',
  'water-valve',
]);

export const deviceArtKey = (type: string): string => {
  const short = type.replace('devices.types.', '');
  return ART_RULES.find(([prefix]) => short.startsWith(prefix))?.[1] ?? 'hub';
};

/** Путь к картинке для карточки или null, если картинки пока нет. */
export const deviceArtUrl = (type: string, night: boolean): string | null => {
  const key = deviceArtKey(type);
  return AVAILABLE_ART.has(key) ? `./device-art/${key}-${night ? 'night' : 'day'}.webp` : null;
};

/**
 * Где на картинке стоит устройство (в процентах) и насколько приблизить, чтобы на карточке
 * оно было хорошо видно. Значения подобраны по каждой картинке; без записи: справа по центру.
 */
const ART_FOCUS: Record<string, [x: number, y: number, zoom: number]> = {
  'air-conditioner': [80, 40, 1.05],
  'blinds': [80, 45, 1.1],
  'bulb': [78, 35, 1.7],
  'button': [70, 66, 1.9],
  'camera': [82, 45, 1.25],
  'ceiling-light': [78, 45, 1.15],
  'climate-sensor': [70, 55, 1.35],
  'dishwasher': [90, 55, 1.2],
  'door-sensor': [72, 45, 1.7],
  'gas-detector': [82, 45, 1.25],
  'hub': [80, 70, 1.7],
  'leak-sensor': [72, 70, 1.8],
  'light-sensor': [74, 60, 1.8],
  'light-strip': [80, 55, 1.2],
  'motion-sensor': [93, 30, 2.1],
  'pet-feeder': [82, 60, 1.25],
  'pet-fountain': [82, 72, 1.7],
  'robot-vacuum': [70, 82, 1.6],
  'socket': [86, 52, 1.35],
  'speaker': [72, 72, 1.3],
  'switch': [82, 52, 1.35],
  'tv-box': [75, 72, 1.6],
  'vibration-sensor': [71, 50, 1.8],
  'water-valve': [72, 45, 1.25],
};

export const deviceArtStyle = (type: string): React.CSSProperties => {
  const [x, y, zoom] = ART_FOCUS[deviceArtKey(type)] ?? [75, 50, 1];
  return { ['--art-x' as any]: `${x}%`, ['--art-y' as any]: `${y}%`, ['--art-zoom' as any]: zoom };
};
