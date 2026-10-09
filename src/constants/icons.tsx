import React from 'react';
import {
  Sun,
  Moon,
  Zap,
  Play,
  Home,
  Coffee,
  PartyPopper,
  Thermometer,
  Lightbulb,
  Music,
  Tv,
  Lock,
  Unlock,
  Power,
  Fan,
  Plug,
  AlarmSmoke,
  AirVent,
  Sunset,
  Speaker,
  LampCeiling,
  Lamp,
  ToggleRight,
  Heater,
  Wind,
  Droplets,
  Droplet,
  Disc,
  CookingPot,
  WashingMachine,
  Utensils,
  Shirt,
  Bot,
  Waves,
  Blinds,
  PawPrint,
  Footprints,
  DoorOpen,
  Flame,
  MousePointerClick,
  Vibrate,
  Cctv,
  Router,
} from 'lucide-react';

// Mapping Yandex icon strings to Lucide React Components
export const SCENARIO_ICON_MAP: Record<string, React.ReactNode> = {
  'icon_morning': <Sun className="w-8 h-8" />,
  'icon_sun': <Sun className="w-8 h-8" />,
  'icon_night': <Moon className="w-8 h-8" />,
  'icon_moon': <Moon className="w-8 h-8" />,
  'icon_party': <PartyPopper className="w-8 h-8" />,
  'icon_alarm': <Zap className="w-8 h-8" />,
  'icon_cleaning': <Home className="w-8 h-8" />, 
  'icon_coffee': <Coffee className="w-8 h-8" />,
  'icon_temp': <Thermometer className="w-8 h-8" />,
  'icon_fan': <Fan className="w-8 h-8" />,
  'icon_airvent': <AirVent className="w-8 h-8" />,
  'icon_sunset': <Sunset className="w-8 h-8" />,
  'default': <Play className="w-8 h-8" />
};

export const getIconForScenario = (iconName?: string, scenarioName?: string): React.ReactNode => {
  if (iconName && SCENARIO_ICON_MAP[iconName]) {
    return SCENARIO_ICON_MAP[iconName];
  }
  
  const lowerName = (scenarioName || '').toLowerCase();
  if (lowerName.includes('свет') || lowerName.includes('light') || lowerName.includes('licht')) return <Lightbulb className="w-8 h-8" />;
  if (lowerName.includes('музык') || lowerName.includes('music') || lowerName.includes('musik')) return <Music className="w-8 h-8" />;
  if (lowerName.includes('тв') || lowerName.includes('tv') || lowerName.includes('кино')) return <Tv className="w-8 h-8" />;
  if (lowerName.includes('утро') || lowerName.includes('morning') || lowerName.includes('morgen')) return <Sun className="w-8 h-8" />;
  if (lowerName.includes('ноч') || lowerName.includes('night') || lowerName.includes('спать') || lowerName.includes('nacht') || lowerName.includes('schlaf')) return <Moon className="w-8 h-8" />;
  if (lowerName.includes('вечер') || lowerName.includes('evening') || lowerName.includes('abend')) return <Sunset className="w-8 h-8" />;
  if (lowerName.includes('колонк') || lowerName.includes('speaker') ) return <Speaker className="w-8 h-8" />;
  if (lowerName.includes('гост') || lowerName.includes('тусов') || lowerName.includes('вечерин') || lowerName.includes('party') ) return <PartyPopper className="w-8 h-8" />;
  if (lowerName.includes('выкл') || lowerName.includes('off')) return <Power className="w-8 h-8" />;
  if (lowerName.includes('откр') || lowerName.includes('open')) return <Unlock className="w-8 h-8" />;
  if (lowerName.includes('закр') || lowerName.includes('close')) return <Lock className="w-8 h-8" />;
  if (lowerName.includes('вентилят') || lowerName.includes('fan') || lowerName.includes('lüfter') || lowerName.includes('ventilator')) return <Fan className="w-8 h-8" />;
  if (lowerName.includes('кондиц') || lowerName.includes('condit') || lowerName.includes('klima')) return <AirVent className="w-8 h-8" />;

  return SCENARIO_ICON_MAP['default'];
};

// Значок по типу устройства: сначала точные подтипы, потом общие классы
const DEVICE_ICONS: Array<[string, React.ElementType]> = [
    ['light.ceiling', LampCeiling], ['light.lamp', Lamp], ['light', Lightbulb],
    ['socket', Plug], ['switch', ToggleRight],
    ['thermostat.ac', AirVent], ['thermostat', Heater],
    ['ventilation.fan', Fan], ['ventilation', Wind], ['humidifier', Droplets], ['purifier', Wind],
    ['media_device.receiver', Speaker], ['media_device.tv_box', Disc], ['media_device', Tv],
    ['smart_speaker', Speaker],
    ['cooking.coffee_maker', Coffee], ['cooking.kettle', Coffee], ['cooking', CookingPot],
    ['washing_machine', WashingMachine], ['dishwasher', Utensils], ['iron', Shirt], ['vacuum_cleaner', Bot],
    ['openable.valve', Waves], ['openable', Blinds],
    ['pet_', PawPrint],
    ['sensor.motion', Footprints], ['sensor.open', DoorOpen], ['sensor.water_leak', Droplet],
    ['sensor.smoke', AlarmSmoke], ['sensor.gas', Flame], ['sensor.button', MousePointerClick],
    ['sensor.vibration', Vibrate], ['sensor.illumination', Sun], ['sensor', Thermometer],
    ['smart_meter.electricity', Zap], ['smart_meter.gas', Flame], ['smart_meter.heat', Thermometer],
    ['smart_meter', Waves],
    ['camera', Cctv], ['hub', Router], ['other', Router],
];

export const getIconForDevice = (type: string): React.ReactNode => {
    const t = type.toLowerCase().replace('devices.types.', '');
    const Icon = DEVICE_ICONS.find(([key]) => t.startsWith(key))?.[1] ?? Zap;
    return <Icon className="w-8 h-8" />;
};
