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
}

export const EMPTY_ZONE_CONFIG: ZoneConfig = { version: 1, zones: [], parents: {} };

export interface ZoneNode {
  id: string;
  kind: 'room' | 'zone';
  name: string;
  icon?: string;
  children: ZoneNode[];
  /** Устройства самой комнаты (у собственной зоны пусто). */
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
    nodes.set(zone.id, { id: zone.id, kind: 'zone', name: zone.name, icon: zone.icon, children: [], deviceIds: [], allDeviceIds: [] });
  }
  for (const room of rooms) {
    const deviceIds = room.devices.filter(id => knownDevices.has(id));
    nodes.set(room.id, { id: room.id, kind: 'room', name: room.name, children: [], deviceIds, allDeviceIds: [] });
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

export const findNode = (nodes: ZoneNode[], id: string): ZoneNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
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

export const setZoneIcon = (config: ZoneConfig, id: string, icon: string): ZoneConfig => ({
  ...config,
  zones: config.zones.map(z => (z.id === id ? { ...z, icon } : z)),
});

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

export interface ZoneSummary {
  lights: { total: number; on: number };
  sockets: { total: number; on: number };
  temperature: number | null;
  humidity: number | null;
  motion: boolean;
  openCount: number;
  unreachable: number;
}

const instanceOf = (item: any): string | undefined => item?.parameters?.instance ?? item?.state?.instance;
const isOn = (device: YandexDevice) =>
  device.capabilities.some(c => c.type === 'devices.capabilities.on_off' && c.state?.value === true);
const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

export const summarizeDevices = (devices: YandexDevice[]): ZoneSummary => {
  const summary: ZoneSummary = {
    lights: { total: 0, on: 0 }, sockets: { total: 0, on: 0 },
    temperature: null, humidity: null, motion: false, openCount: 0, unreachable: 0,
  };
  const temperatures: number[] = [];
  const humidities: number[] = [];

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
      }
      if (property.type === 'devices.properties.event') {
        if (instance === 'motion' && value === 'detected') summary.motion = true;
        if (instance === 'open' && value === 'opened') summary.openCount += 1;
      }
    }
  }
  summary.temperature = average(temperatures);
  summary.humidity = average(humidities);
  return summary;
};

/** Зона «активна», если в ней замечено движение или что-то открыто. */
export const isZoneActive = (summary: ZoneSummary) => summary.motion || summary.openCount > 0;
