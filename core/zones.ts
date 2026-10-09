// Зоны: свободное дерево из комнат сервисов и собственных зон (этажи, сад и т. п.).
// Хранится отдельно от сервисов, логика без React и Electron.
import type { YandexDevice } from '../src/types/index';
import type { HomeData } from './model';

export interface CustomZone {
  id: string;
  name: string;
  householdId: string;
  icon?: string;
}

export interface ZoneConfig {
  version: 1;
  zones: CustomZone[];
  /** Родитель комнаты или зоны (ID зоны). Нет записи: прямо в доме. */
  parents: Record<string, string>;
  /** Значки, выбранные для комнат из сервисов (у собственных зон значок хранится в самой зоне). */
  icons?: Record<string, string>;
  /** Собственные группы устройств поверх всех сервисов (см. groups.ts). */
  groups?: CustomGroup[];
  /** Своё название и своя комната (или собственная зона) для устройства; сервис об этом не знает. */
  devices?: Record<string, DeviceOverride>;
}

export interface DeviceOverride {
  name?: string;
  /** ID комнаты сервиса или собственной зоны. */
  room?: string;
}

export interface CustomGroup {
  id: string;
  name: string;
  householdId: string;
  deviceIds: string[];
}

export const EMPTY_ZONE_CONFIG: ZoneConfig = { version: 1, zones: [], parents: {} };

export interface ZoneNode {
  id: string;
  kind: 'room' | 'zone';
  name: string;
  icon?: string;
  children: ZoneNode[];
  /** Устройства прямо в этой комнате или зоне (без вложенных). */
  deviceIds: string[];
  /** Устройства вместе со всеми вложенными комнатами и зонами. */
  allDeviceIds: string[];
}

export const isCustomZoneId = (id: string) => id.startsWith('zone:');

/** Проверяет, что ID и его родитель существуют в этом доме. */
const validParent = (config: ZoneConfig, nodeIds: Set<string>, id: string): string | null => {
  const parent = config.parents[id];
  return parent && nodeIds.has(parent) && isCustomZoneId(parent) ? parent : null;
};

/** Цепочка предков: нужна, чтобы не допустить кольцо. */
const ancestors = (config: ZoneConfig, id: string): string[] => {
  const result: string[] = [];
  let current = config.parents[id];
  while (current && !result.includes(current)) {
    result.push(current);
    current = config.parents[current];
  }
  return result;
};

export const buildZoneTree = (home: HomeData, config: ZoneConfig, householdId: string | null): ZoneNode[] => {
  const rooms = home.rooms.filter(r => !householdId || r.household_id === householdId);
  const zones = config.zones.filter(z => !householdId || z.householdId === householdId);
  const knownDevices = new Set(home.devices.map(d => d.id));

  const nodes = new Map<string, ZoneNode>();
  for (const zone of zones) {
    const deviceIds = home.devices.filter(d => d.room === zone.id).map(d => d.id);
    nodes.set(zone.id, { id: zone.id, kind: 'zone', name: zone.name, icon: zone.icon, children: [], deviceIds, allDeviceIds: [] });
  }
  for (const room of rooms) {
    const deviceIds = room.devices.filter(id => knownDevices.has(id));
    const icon = config.icons?.[room.id] ?? guessRoomIcon(room.name);
    nodes.set(room.id, { id: room.id, kind: 'room', name: room.name, icon, children: [], deviceIds, allDeviceIds: [] });
  }

  const ids = new Set(nodes.keys());
  const roots: ZoneNode[] = [];
  // Сначала собственные зоны (этажи), затем комнаты в порядке сервиса
  for (const node of nodes.values()) {
    const parent = validParent(config, ids, node.id);
    const isRing = parent !== null && ancestors(config, parent).includes(node.id);
    if (parent && !isRing && parent !== node.id) nodes.get(parent)!.children.push(node);
    else roots.push(node);
  }

  const collect = (node: ZoneNode): string[] => {
    node.allDeviceIds = [...node.deviceIds, ...node.children.flatMap(collect)];
    return node.allDeviceIds;
  };
  roots.forEach(collect);
  return roots;
};

export interface FlatZoneNode extends ZoneNode {
  depth: number;
}

export const flattenTree = (nodes: ZoneNode[], depth = 0): FlatZoneNode[] =>
  nodes.flatMap(node => [{ ...node, depth }, ...flattenTree(node.children, depth + 1)]);

/** Для поиска: устройство → названия его комнаты и всех зон над ней. */
export const placeNames = (nodes: ZoneNode[], above: string[] = [], result = new Map<string, string[]>()): Map<string, string[]> => {
  for (const node of nodes) {
    const names = [...above, node.name];
    node.deviceIds.forEach(id => result.set(id, names));
    placeNames(node.children, names, result);
  }
  return result;
};

/** Устройства, у которых название, комната или зона содержит запрос (без учёта регистра). */
export const searchDevices = (devices: Array<{ id: string; name: string }>, tree: ZoneNode[], query: string): Set<string> => {
  const needle = query.trim().toLocaleLowerCase();
  const places = placeNames(tree);
  return new Set(devices
    .filter(d => [d.name, ...(places.get(d.id) ?? [])].some(text => text.toLocaleLowerCase().includes(needle)))
    .map(d => d.id));
};

export const findNode = (nodes: ZoneNode[], id: string): ZoneNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
};

// --- Свои названия и комнаты устройств ---

/** Дом с учётом своих названий и комнат: устройство переезжает из комнаты сервиса в выбранную. */
export const applyDeviceOverrides = (home: HomeData, config: ZoneConfig): HomeData => {
  const overrides = config.devices ?? {};
  if (Object.keys(overrides).length === 0) return home;
  const roomIds = new Set(home.rooms.map(r => r.id));
  const zoneHouse = new Map(config.zones.map(z => [z.id, z.householdId]));
  const moved = new Map<string, string>();
  const devices = home.devices.map(device => {
    const override = overrides[device.id];
    if (!override) return device;
    const target = override.room && (roomIds.has(override.room) || zoneHouse.has(override.room)) ? override.room : undefined;
    if (target && target !== device.room) moved.set(device.id, target);
    // В собственной зоне дом берём у зоны, чтобы устройство не потерялось при фильтре по дому
    const household = target && zoneHouse.get(target);
    return {
      ...device,
      name: override.name?.trim() || device.name,
      room: target ?? device.room,
      ...(household ? { household_id: household } : {}),
    };
  });
  const rooms = home.rooms.map(room => {
    const kept = room.devices.filter(id => !moved.has(id));
    const added = [...moved].filter(([, target]) => target === room.id).map(([id]) => id);
    return kept.length === room.devices.length && added.length === 0 ? room : { ...room, devices: [...kept, ...added] };
  });
  return { ...home, devices, rooms };
};

const setOverride = (config: ZoneConfig, deviceId: string, patch: DeviceOverride): ZoneConfig => {
  const next = { ...(config.devices?.[deviceId] ?? {}), ...patch };
  if (!next.name) delete next.name;
  if (!next.room) delete next.room;
  const devices = { ...config.devices };
  if (Object.keys(next).length) devices[deviceId] = next;
  else delete devices[deviceId];
  return { ...config, devices };
};

/** Пустое название: снова название из сервиса. */
export const setDeviceName = (config: ZoneConfig, deviceId: string, name: string) =>
  setOverride(config, deviceId, { name: name.trim() || undefined });

/** null: снова комната из сервиса. */
export const setDeviceRoom = (config: ZoneConfig, deviceId: string, room: string | null) =>
  setOverride(config, deviceId, { room: room ?? undefined });

/** При удалении зоны её устройства возвращаются в комнаты сервисов. */
const releaseZoneDevices = (config: ZoneConfig, zoneId: string): ZoneConfig => {
  let next = config;
  for (const [deviceId, override] of Object.entries(config.devices ?? {})) {
    if (override.room === zoneId) next = setDeviceRoom(next, deviceId, null);
  }
  return next;
};

// --- Изменения конфигурации (возвращают новую копию) ---

export const addZone = (
  config: ZoneConfig,
  zone: { name: string; householdId: string; icon?: string; parentId?: string | null },
  makeId: () => string = () => `zone:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
): { config: ZoneConfig; id: string } => {
  const id = makeId();
  const next: ZoneConfig = {
    ...config,
    zones: [...config.zones, { id, name: zone.name.trim(), householdId: zone.householdId, icon: zone.icon }],
    parents: { ...config.parents },
  };
  if (zone.parentId) next.parents[id] = zone.parentId;
  return { config: next, id };
};

export const renameZone = (config: ZoneConfig, id: string, name: string): ZoneConfig => ({
  ...config,
  zones: config.zones.map(z => (z.id === id ? { ...z, name: name.trim() || z.name } : z)),
});

/** Значок для собственной зоны или для комнаты из сервиса. */
export const setZoneIcon = (config: ZoneConfig, id: string, icon: string): ZoneConfig =>
  isCustomZoneId(id)
    ? { ...config, zones: config.zones.map(z => (z.id === id ? { ...z, icon } : z)) }
    : { ...config, icons: { ...config.icons, [id]: icon } };

// Ключевые слова названий комнат (русский, немецкий, английский) -> значок
const ROOM_KEYWORDS: Array<[string, string[]]> = [
  ['kitchen', ['кухн', 'küche', 'kueche', 'kitchen']],
  ['bedroom', ['спальн', 'schlafzimmer', 'schlafraum', 'bedroom']],
  ['kids', ['детск', 'kinder', 'kids', 'nursery']],
  ['living', ['гостин', 'зал', 'wohnzimmer', 'living', 'lounge']],
  ['dining', ['столов', 'esszimmer', 'dining']],
  ['bath', ['ванн', 'туалет', 'санузел', 'bad', 'wc', 'toilet', 'bath']],
  ['office', ['кабинет', 'офис', 'büro', 'buero', 'arbeitszimmer', 'office', 'study']],
  ['hall', ['прихож', 'коридор', 'холл', 'flur', 'diele', 'eingang', 'hall', 'entrance', 'corridor']],
  ['garage', ['гараж', 'garage']],
  ['garden', ['сад', 'двор', 'участ', 'garten', 'hof', 'garden', 'yard']],
  ['balcony', ['балкон', 'терраса', 'лоджия', 'balkon', 'terrasse', 'balcony', 'terrace']],
  ['basement', ['подвал', 'погреб', 'keller', 'basement', 'cellar']],
  ['laundry', ['прачеч', 'постироч', 'waschküche', 'hauswirtschaft', 'laundry']],
  ['workshop', ['мастерск', 'werkstatt', 'workshop']],
  ['gym', ['спортзал', 'тренаж', 'fitness', 'gym']],
  ['sauna', ['баня', 'сауна', 'sauna']],
];

/** Подбирает значок по названию комнаты; undefined, если ничего не подошло. */
export const guessRoomIcon = (name: string): string | undefined => {
  const lower = name.toLowerCase();
  // Самое длинное совпадение точнее: «Waschküche» — прачечная, а не кухня
  let best: { icon: string; length: number } | undefined;
  for (const [icon, words] of ROOM_KEYWORDS) {
    for (const word of words) {
      if (lower.includes(word) && word.length > (best?.length ?? 0)) best = { icon, length: word.length };
    }
  }
  return best?.icon;
};

/** Переносит комнату или зону в другую зону (null: прямо в дом). Кольца не допускаются. */
export const moveNode = (config: ZoneConfig, id: string, parentId: string | null): ZoneConfig => {
  const parents = { ...config.parents };
  if (!parentId || parentId === id) {
    delete parents[id];
    return { ...config, parents };
  }
  if (!isCustomZoneId(parentId) || ancestors(config, parentId).includes(id)) {
    delete parents[id];
    return { ...config, parents };
  }
  parents[id] = parentId;
  return { ...config, parents };
};

/** Удаляет собственную зону; её содержимое поднимается на уровень выше. */
export const removeZone = (config: ZoneConfig, id: string): ZoneConfig => {
  config = releaseZoneDevices(config, id);
  const up = config.parents[id];
  const parents: Record<string, string> = {};
  for (const [child, parent] of Object.entries(config.parents)) {
    if (child === id) continue;
    if (parent === id) {
      if (up) parents[child] = up;
    } else {
      parents[child] = parent;
    }
  }
  return { ...config, zones: config.zones.filter(z => z.id !== id), parents };
};

// --- Сводка по устройствам зоны ---

/** Сколько зона остаётся «активной» после последнего движения. */
export const ACTIVITY_HOLD_MS = 5 * 60_000;

export interface ZoneSummary {
  lights: { total: number; on: number };
  sockets: { total: number; on: number };
  temperature: number | null;
  humidity: number | null;
  /** Сумма мощности устройств с измерением (Вт), null: никто не измеряет. */
  power: number | null;
  /** Движение сейчас. */
  motion: boolean;
  /** Время последнего события датчика движения (мс), null: неизвестно. */
  lastMotion: number | null;
  openCount: number;
  unreachable: number;
}

const instanceOf = (item: any): string | undefined => item?.parameters?.instance ?? item?.state?.instance;
const isOn = (device: YandexDevice) =>
  device.capabilities.some(c => c.type === 'devices.capabilities.on_off' && c.state?.value === true);
const hasOnOff = (device: YandexDevice) => device.capabilities.some(c => c.type === 'devices.capabilities.on_off');
const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
/** last_updated у Яндекса в секундах; 0 или нет поля: время неизвестно. */
const updatedAt = (property: any): number | null =>
  typeof property?.last_updated === 'number' && property.last_updated > 0 ? property.last_updated * 1000 : null;

export const summarizeDevices = (devices: YandexDevice[], now = Date.now()): ZoneSummary => {
  const summary: ZoneSummary = {
    lights: { total: 0, on: 0 }, sockets: { total: 0, on: 0 },
    temperature: null, humidity: null, power: null, motion: false, lastMotion: null, openCount: 0, unreachable: 0,
  };
  const temperatures: number[] = [];
  const humidities: number[] = [];
  const powers: number[] = [];

  for (const device of devices) {
    if (device.unreachable) summary.unreachable += 1;
    const on = !device.unreachable && isOn(device);
    if (device.type.startsWith('devices.types.light')) {
      summary.lights.total += 1;
      if (on) summary.lights.on += 1;
    } else if (device.type === 'devices.types.socket') {
      summary.sockets.total += 1;
      if (on) summary.sockets.on += 1;
    }
    if (device.unreachable) continue;
    for (const property of device.properties ?? []) {
      const instance = instanceOf(property);
      const value = (property as any).state?.value;
      if (property.type === 'devices.properties.float' && typeof value === 'number') {
        if (instance === 'temperature') temperatures.push(value);
        if (instance === 'humidity') humidities.push(value);
        if (instance === 'power') powers.push(value);
      }
      if (property.type === 'devices.properties.event') {
        if (instance === 'motion') {
          const at = updatedAt(property);
          if (at !== null && (value === 'detected' || value === 'not_detected')) {
            summary.lastMotion = Math.max(summary.lastMotion ?? 0, at);
          }
          // «Движение» без времени считаем текущим; со временем только если оно свежее
          if (value === 'detected' && (at === null || now - at < ACTIVITY_HOLD_MS)) summary.motion = true;
        }
        if (instance === 'open' && value === 'opened') summary.openCount += 1;
      }
    }
  }
  summary.temperature = average(temperatures);
  summary.humidity = average(humidities);
  summary.power = powers.length ? Math.round(powers.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  return summary;
};

/** Зона «активна»: движение сейчас или недавно, либо что-то открыто. */
export const isZoneActive = (summary: ZoneSummary, now = Date.now()) =>
  summary.motion
  || summary.openCount > 0
  || (summary.lastMotion !== null && now - summary.lastMotion < ACTIVITY_HOLD_MS);

// --- Категории для общего управления зоной ---

export type ZoneCategoryKey = 'light' | 'socket' | 'climate' | 'openable' | 'media';

export interface ZoneCategory {
  key: ZoneCategoryKey;
  deviceIds: string[];
  /** Включено (недоступные не считаются). */
  on: number;
  total: number;
}

const CATEGORY_ORDER: ZoneCategoryKey[] = ['light', 'socket', 'climate', 'openable', 'media'];

/** Категория устройства с выключателем; null: не участвует в общем управлении. */
export const categoryOf = (device: YandexDevice): ZoneCategoryKey | null => {
  if (!hasOnOff(device)) return null;
  const type = device.type;
  if (type.startsWith('devices.types.light')) return 'light';
  if (type === 'devices.types.socket') return 'socket';
  if (
    type.startsWith('devices.types.thermostat')
    || type.startsWith('devices.types.ventilation')
    || type.startsWith('devices.types.humidifier')
    || type.startsWith('devices.types.purifier')
  ) return 'climate';
  if (type.startsWith('devices.types.openable')) return 'openable';
  if (type.startsWith('devices.types.media_device')) return 'media';
  return null;
};

export const zoneCategories = (devices: YandexDevice[]): ZoneCategory[] => {
  const byKey = new Map<ZoneCategoryKey, ZoneCategory>();
  for (const device of devices) {
    const key = categoryOf(device);
    if (!key) continue;
    const category = byKey.get(key) ?? { key, deviceIds: [], on: 0, total: 0 };
    category.deviceIds.push(device.id);
    category.total += 1;
    if (!device.unreachable && isOn(device)) category.on += 1;
    byKey.set(key, category);
  }
  return CATEGORY_ORDER.filter(key => byKey.has(key)).map(key => byKey.get(key)!);
};
