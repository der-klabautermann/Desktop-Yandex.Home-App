// Ausstellungshaus für die Vorschau (?mock=all): jede Geräteart, die die Dienste liefern können,
// mit typischen Fähigkeiten und Messwerten. Nur für npm run preview:web, nicht in der App.
import type { YandexDevice, YandexUserInfoResponse } from '../types';

const cap = (type: string, state: { instance: string; value: unknown } | null, parameters?: object) => ({
  type, retrievable: true, reportable: true,
  ...(parameters ? { parameters } : {}),
  ...(state ? { state } : {}),
});

const onOff = (value: boolean) => cap('devices.capabilities.on_off', { instance: 'on', value });
const range = (instance: string, value: number, min: number, max: number, unit = 'unit.percent', precision = 1) =>
  cap('devices.capabilities.range', { instance, value }, { instance, unit, range: { min, max, precision } });
const mode = (instance: string, value: string, values: string[]) =>
  cap('devices.capabilities.mode', { instance, value }, { instance, modes: values.map(v => ({ value: v })) });
const toggle = (instance: string, value: boolean) => cap('devices.capabilities.toggle', { instance, value }, { instance });
const color = (hsv: boolean, temperature: boolean, value: { instance: string; value: unknown }) =>
  cap('devices.capabilities.color_setting', value, {
    ...(hsv ? { color_model: 'hsv' } : {}),
    ...(temperature ? { temperature_k: { min: 2700, max: 6500, precision: 100 } } : {}),
  });
const videoStream = () => cap('devices.capabilities.video_stream', null, { protocols: ['hls'] });

const minutesAgo = (minutes: number) => Date.now() / 1000 - minutes * 60;
const float = (instance: string, value: number, unit: string) => ({
  type: 'devices.properties.float', retrievable: true, reportable: true,
  parameters: { instance, unit }, state: { instance, value }, last_updated: minutesAgo(1),
});
const event = (instance: string, value: string, values: string[], ago = 30) => ({
  type: 'devices.properties.event', retrievable: true, reportable: true,
  parameters: { instance, events: values.map(v => ({ value: v })) }, state: { instance, value }, last_updated: minutesAgo(ago),
});
const battery = (value: number) => float('battery_level', value, 'unit.percent');
const energy = (watt: number) => [float('power', watt, 'unit.watt'), float('voltage', 229.8, 'unit.volt'), float('amperage', Math.round(watt / 229.8 * 1000) / 1000, 'unit.ampere')];

type Provider = 'yandex' | 'aqara' | 'homeassistant';
type Spec = [id: string, name: string, type: string, room: string, provider: Provider, capabilities: any[], properties?: any[]];

const HOUSEHOLD = 'show-home';

const ROOMS: Array<[string, string]> = [
  ['living', 'Wohnzimmer'], ['kitchen', 'Küche'], ['bedroom', 'Schlafzimmer'], ['kids', 'Kinderzimmer'],
  ['bath', 'Bad'], ['hall', 'Flur'], ['office', 'Büro'], ['basement', 'Keller'], ['garden', 'Garten'],
];

const DEVICES: Spec[] = [
  // Wohnzimmer
  ['ceiling', 'Deckenlampe', 'devices.types.light.ceiling', 'living', 'yandex',
    [onOff(true), range('brightness', 80, 1, 100), color(true, true, { instance: 'temperature_k', value: 4000 })], energy(9.5)],
  ['floor-lamp', 'Stehlampe', 'devices.types.light.lamp', 'living', 'yandex',
    [onOff(false), range('brightness', 40, 1, 100), color(false, true, { instance: 'temperature_k', value: 2700 })]],
  ['strip', 'LED-Streifen', 'devices.types.light.strip', 'living', 'homeassistant',
    [onOff(true), range('brightness', 60, 1, 100), color(true, false, { instance: 'hsv', value: { h: 265, s: 80, v: 60 } })]],
  ['tv', 'Fernseher', 'devices.types.media_device.tv', 'living', 'yandex',
    [onOff(true), range('volume', 18, 0, 100, 'unit.percent'), range('channel', 5, 1, 999, 'unit.number'), toggle('mute', false), mode('input_source', 'one', ['one', 'two', 'three'])]],
  ['tv-box', 'TV-Box', 'devices.types.media_device.tv_box', 'living', 'yandex',
    [onOff(false), range('volume', 30, 0, 100), toggle('pause', false)]],
  ['receiver', 'AV-Receiver', 'devices.types.media_device.receiver', 'living', 'homeassistant',
    [onOff(false), range('volume', 25, 0, 100), toggle('mute', false), mode('input_source', 'two', ['one', 'two', 'three', 'four'])]],
  ['station', 'Yandex Station Max', 'devices.types.smart_speaker.yandex.station_2', 'living', 'yandex', []],
  ['ac', 'Klimaanlage', 'devices.types.thermostat.ac', 'living', 'yandex',
    [onOff(false), range('temperature', 23, 16, 30, 'unit.temperature.celsius'), mode('thermostat', 'cool', ['auto', 'cool', 'heat', 'dry', 'fan_only']), mode('fan_speed', 'auto', ['auto', 'low', 'medium', 'high']), toggle('oscillation', true)]],
  ['curtain', 'Vorhänge', 'devices.types.openable.curtain', 'living', 'aqara',
    [onOff(true), range('open', 100, 0, 100), toggle('pause', false)], [battery(72)]],

  // Küche
  ['kettle', 'Wasserkocher', 'devices.types.cooking.kettle', 'kitchen', 'homeassistant',
    [onOff(false), range('temperature', 90, 40, 100, 'unit.temperature.celsius'), toggle('keep_warm', false), toggle('backlight', true)]],
  ['coffee', 'Kaffeemaschine', 'devices.types.cooking.coffee_maker', 'kitchen', 'yandex',
    [onOff(false), mode('coffee_mode', 'cappuccino', ['americano', 'cappuccino', 'espresso', 'latte'])]],
  ['multicooker', 'Multikocher', 'devices.types.cooking.multicooker', 'kitchen', 'yandex',
    [onOff(false), mode('program', 'stewing', ['baking', 'frying', 'porridge', 'stewing', 'steam'])]],
  ['cooking', 'Küchengerät', 'devices.types.cooking', 'kitchen', 'yandex', [onOff(false)]],
  ['dishwasher', 'Geschirrspüler', 'devices.types.dishwasher', 'kitchen', 'homeassistant',
    [onOff(true), mode('program', 'eco', ['auto', 'eco', 'intensive', 'quick'])]],
  ['kitchen-plug', 'Steckdose Arbeitsplatte', 'devices.types.socket', 'kitchen', 'aqara', [onOff(true)], energy(1250)],
  ['leak', 'Wassermelder Spüle', 'devices.types.sensor.water_leak', 'kitchen', 'aqara', [],
    [event('water_leak', 'dry', ['dry', 'leak']), battery(91)]],
  ['smoke', 'Rauchmelder', 'devices.types.sensor.smoke', 'kitchen', 'aqara', [],
    [event('smoke', 'not_detected', ['detected', 'not_detected', 'high']), battery(88)]],
  ['gas', 'Gasmelder', 'devices.types.sensor.gas', 'kitchen', 'aqara', [],
    [event('gas', 'not_detected', ['detected', 'not_detected', 'high'])]],
  ['feeder', 'Futterautomat', 'devices.types.pet_feeder', 'kitchen', 'homeassistant',
    [onOff(false)], [float('food_level', 64, 'unit.percent')]],
  ['fountain', 'Trinkbrunnen', 'devices.types.pet_drinking_fountain', 'kitchen', 'homeassistant',
    [onOff(true)], [float('water_level', 48, 'unit.percent')]],

  // Schlafzimmer
  ['bedside', 'Nachttischlampe', 'devices.types.light', 'bedroom', 'yandex',
    [onOff(false), range('brightness', 20, 1, 100)]],
  ['humidifier', 'Luftbefeuchter', 'devices.types.humidifier', 'bedroom', 'homeassistant',
    [onOff(true), range('humidity', 50, 30, 80, 'unit.percent'), mode('fan_speed', 'low', ['auto', 'low', 'medium', 'high']), toggle('ionization', false)],
    [float('humidity', 44, 'unit.percent'), float('water_level', 70, 'unit.percent')]],
  ['radiator', 'Heizkörperthermostat', 'devices.types.thermostat', 'bedroom', 'aqara',
    [onOff(true), range('temperature', 20, 5, 30, 'unit.temperature.celsius', 0.5), mode('thermostat', 'heat', ['auto', 'heat', 'eco'])],
    [float('temperature', 19.5, 'unit.temperature.celsius'), battery(64)]],
  ['blinds', 'Jalousie', 'devices.types.openable', 'bedroom', 'aqara', [onOff(false), range('open', 0, 0, 100)]],
  ['climate-bed', 'Klimasensor', 'devices.types.sensor.climate', 'bedroom', 'aqara', [],
    [float('temperature', 21.3, 'unit.temperature.celsius'), float('humidity', 47, 'unit.percent'), float('pressure', 752, 'unit.pressure.mmhg'), battery(83)]],

  // Kinderzimmer
  ['nightlight', 'Nachtlicht', 'devices.types.light', 'kids', 'homeassistant',
    [onOff(true), range('brightness', 10, 1, 100), color(true, false, { instance: 'hsv', value: { h: 30, s: 70, v: 10 } })]],
  ['fan', 'Ventilator', 'devices.types.ventilation.fan', 'kids', 'homeassistant',
    [onOff(false), mode('fan_speed', 'medium', ['low', 'medium', 'high', 'turbo']), toggle('oscillation', true)]],
  ['purifier', 'Luftreiniger', 'devices.types.purifier', 'kids', 'homeassistant',
    [onOff(true), mode('fan_speed', 'auto', ['auto', 'low', 'medium', 'high']), toggle('controls_locked', true)],
    [float('pm2.5_density', 7, 'unit.density.mcg_m3')]],
  ['air', 'Luftqualität', 'devices.types.sensor.climate', 'kids', 'aqara', [],
    [float('co2_level', 820, 'unit.ppm'), float('tvoc', 140, 'unit.density.mcg_m3'), float('pm2.5_density', 9, 'unit.density.mcg_m3'), float('temperature', 22.1, 'unit.temperature.celsius')]],

  // Bad
  ['washer', 'Waschmaschine', 'devices.types.washing_machine', 'bath', 'yandex',
    [onOff(true), mode('program', 'cotton', ['auto', 'cotton', 'wool', 'quick', 'delicate']), toggle('pause', false)], energy(410)],
  ['iron', 'Bügeleisen', 'devices.types.iron', 'bath', 'yandex', [onOff(false)]],
  ['bath-fan', 'Badlüfter', 'devices.types.ventilation', 'bath', 'aqara', [onOff(true)]],
  ['valve', 'Wasserventil', 'devices.types.openable.valve', 'bath', 'aqara', [onOff(true)]],
  ['motion-bath', 'Bewegungsmelder Bad', 'devices.types.sensor.motion', 'bath', 'aqara', [],
    [event('motion', 'not_detected', ['detected', 'not_detected'], 2), float('illumination', 120, 'unit.illumination.lux'), battery(77)]],

  // Flur
  ['switch', 'Lichtschalter', 'devices.types.switch', 'hall', 'aqara', [onOff(false)]],
  ['relay', 'Relais Außenlicht', 'devices.types.switch.relay', 'hall', 'homeassistant', [onOff(true)]],
  ['door', 'Haustür', 'devices.types.sensor.open', 'hall', 'aqara', [],
    [event('open', 'closed', ['opened', 'closed']), battery(95)]],
  ['window', 'Fenster Flur', 'devices.types.sensor.open', 'hall', 'aqara', [],
    [event('open', 'opened', ['opened', 'closed'], 12), battery(60)]],
  ['button', 'Taster', 'devices.types.sensor.button', 'hall', 'aqara', [],
    [event('button', 'click', ['click', 'double_click', 'long_press'], 45), battery(99)]],
  ['vibration', 'Erschütterungssensor', 'devices.types.sensor.vibration', 'hall', 'aqara', [],
    [event('vibration', 'tilt', ['tilt', 'fall', 'vibration'], 300)]],
  ['illum', 'Helligkeitssensor', 'devices.types.sensor.illumination', 'hall', 'aqara', [],
    [float('illumination', 340, 'unit.illumination.lux')]],
  ['camera', 'Kamera Eingang', 'devices.types.camera', 'hall', 'yandex', [onOff(true), videoStream()]],
  ['hub', 'Zigbee-Hub', 'devices.types.other', 'hall', 'aqara', []],

  // Büro
  ['desk-lamp', 'Schreibtischlampe', 'devices.types.light.lamp', 'office', 'homeassistant',
    [onOff(true), range('brightness', 100, 1, 100), color(false, true, { instance: 'temperature_k', value: 5000 })]],
  ['monitor-plug', 'Steckdose Monitor', 'devices.types.socket', 'office', 'yandex', [onOff(true)], energy(38.2)],
  ['vacuum', 'Saugroboter', 'devices.types.vacuum_cleaner', 'office', 'homeassistant',
    [onOff(false), mode('work_speed', 'normal', ['quiet', 'normal', 'fast', 'turbo']), mode('cleanup_mode', 'dry_cleaning', ['dry_cleaning', 'wet_cleaning', 'mixed_cleaning']), toggle('pause', false)],
    [battery(100)]],

  // Keller
  ['meter-power', 'Stromzähler', 'devices.types.smart_meter.electricity', 'basement', 'homeassistant', [],
    [float('electricity_meter', 18342.6, 'unit.kilowatt_hour'), float('power', 1840, 'unit.watt')]],
  ['meter-gas', 'Gaszähler', 'devices.types.smart_meter.gas', 'basement', 'homeassistant', [],
    [float('gas_meter', 4211.3, 'unit.cubic_meter')]],
  ['meter-cold', 'Kaltwasserzähler', 'devices.types.smart_meter.cold_water', 'basement', 'homeassistant', [],
    [float('water_meter', 512.84, 'unit.cubic_meter')]],
  ['meter-hot', 'Warmwasserzähler', 'devices.types.smart_meter.hot_water', 'basement', 'homeassistant', [],
    [float('water_meter', 203.11, 'unit.cubic_meter')]],
  ['meter-heat', 'Wärmezähler', 'devices.types.smart_meter.heat', 'basement', 'homeassistant', [],
    [float('heat_meter', 21.7, 'unit.gigacalorie')]],
  ['basement-leak', 'Wassermelder Keller', 'devices.types.sensor.water_leak', 'basement', 'aqara', [],
    [event('water_leak', 'leak', ['dry', 'leak'], 3), battery(40)]],

  // Garten
  ['garden-light', 'Gartenbeleuchtung', 'devices.types.light', 'garden', 'aqara', [onOff(false), range('brightness', 70, 1, 100)]],
  ['irrigation', 'Bewässerung', 'devices.types.openable.valve', 'garden', 'homeassistant', [onOff(false)]],
  ['outdoor', 'Außensensor', 'devices.types.sensor.climate', 'garden', 'aqara', [],
    [float('temperature', 11.4, 'unit.temperature.celsius'), float('humidity', 78, 'unit.percent'), battery(55)]],
];

const yandexStep = (items: Array<[id: string, on: boolean, brightness?: number]>) => ({
  type: 'scenarios.steps.actions.v2',
  parameters: {
    items: items.map(([id, on, brightness]) => ({
      id, type: 'step.action.item.device',
      value: {
        id, capabilities: [
          { type: 'devices.capabilities.on_off', state: { instance: 'on', value: on } },
          ...(brightness ? [{ type: 'devices.capabilities.range', state: { instance: 'brightness', value: brightness } }] : []),
        ],
      },
    })),
  },
});

const PREFIX: Record<Provider, string> = { yandex: '', aqara: 'aqara:', homeassistant: 'homeassistant:' };
const MAKER: Record<Provider, string> = { yandex: 'Yandex', aqara: 'Aqara', homeassistant: 'Xiaomi' };

export const createShowroomHome = (): YandexUserInfoResponse => {
  const devices: YandexDevice[] = DEVICES.map(([id, name, type, room, provider, capabilities, properties]) => ({
    id: PREFIX[provider] + id, name, type, room, household_id: HOUSEHOLD, provider_id: provider,
    capabilities, ...(properties ? { properties } : {}),
    device_info: { manufacturer: MAKER[provider], model: `${MAKER[provider].slice(0, 4).toUpperCase()}-${id.toUpperCase()}`, sw_version: '1.4.2' },
  }) as YandexDevice);

  return {
    status: 'ok',
    request_id: 'showroom',
    households: [{ id: HOUSEHOLD, name: 'Zuhause', provider_id: 'yandex' }] as any,
    rooms: ROOMS.map(([id, name]) => ({
      id, name, household_id: HOUSEHOLD, provider_id: 'yandex',
      devices: devices.filter(d => d.room === id).map(d => d.id),
    })),
    groups: [{
      id: 'group-living', name: 'Licht Wohnzimmer', household_id: HOUSEHOLD, provider_id: 'yandex',
      devices: ['ceiling', 'floor-lamp'], capabilities: [onOff(true)],
    }] as any,
    devices,
    scenarios: [
      // Шаги в формате Яндекса: действия устройств и пауза, как их отдаёт сервис
      { id: 'sc-movie', name: 'Filmabend', is_active: true, provider_id: 'yandex', steps: [
        yandexStep([['ceiling', false], ['floor-lamp', true, 30], ['tv', true]]),
      ] },
      { id: 'sc-night', name: 'Gute Nacht', is_active: true, provider_id: 'yandex', steps: [
        yandexStep([['tv', false], ['floor-lamp', false]]),
        { type: 'scenarios.steps.delay', parameters: { delay_ms: 180000 } },
        yandexStep([['ceiling', false], ['bedside', true, 10]]),
      ] },
      { id: 'aqara:sc-away', name: 'Alle weg', is_active: true, provider_id: 'aqara' },
    ] as any,
  };
};
