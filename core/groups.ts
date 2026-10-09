// Собственные группы: устройства разных сервисов, которые включаются вместе.
// Хранятся в той же конфигурации, что и зоны (zones.json).
import type { YandexDevice, YandexGroup } from '../src/types/index';
import type { HomeData } from './model';
import type { CustomGroup, ZoneConfig } from './zones';

export const isCustomGroupId = (id: string) => id.startsWith('cgroup:');

/** В группу можно взять только то, что умеет включаться и выключаться. */
export const isGroupable = (device: YandexDevice) =>
  device.capabilities.some(c => c.type === 'devices.capabilities.on_off');

export const addGroup = (
  config: ZoneConfig,
  group: { name: string; householdId: string; deviceIds: string[] },
  makeId: () => string = () => `cgroup:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
): { config: ZoneConfig; id: string } => {
  const id = makeId();
  const created: CustomGroup = { id, name: group.name.trim(), householdId: group.householdId, deviceIds: [...new Set(group.deviceIds)] };
  return { config: { ...config, groups: [...(config.groups ?? []), created] }, id };
};

export const updateGroup = (config: ZoneConfig, id: string, changes: { name?: string; deviceIds?: string[] }): ZoneConfig => ({
  ...config,
  groups: (config.groups ?? []).map(g => g.id !== id ? g : {
    ...g,
    name: changes.name !== undefined ? changes.name.trim() || g.name : g.name,
    deviceIds: changes.deviceIds !== undefined ? [...new Set(changes.deviceIds)] : g.deviceIds,
  }),
});

export const removeGroup = (config: ZoneConfig, id: string): ZoneConfig => ({
  ...config,
  groups: (config.groups ?? []).filter(g => g.id !== id),
});

/**
 * Собственные группы в формате групп сервисов, чтобы интерфейс показывал их как обычные.
 * Пропавшие устройства не попадают в группу; выключатель «включён», если включено всё.
 */
export const customGroupsAsYandex = (config: ZoneConfig, home: HomeData): YandexGroup[] => {
  const byId = new Map(home.devices.map(d => [d.id, d]));
  return (config.groups ?? []).map(group => {
    const devices = group.deviceIds.map(id => byId.get(id)).filter(Boolean) as YandexDevice[];
    const switchable = devices.filter(d => !d.unreachable && isGroupable(d));
    const allOn = switchable.length > 0 && switchable.every(d =>
      d.capabilities.some(c => c.type === 'devices.capabilities.on_off' && c.state?.value === true));
    return {
      id: group.id,
      name: group.name,
      household_id: group.householdId,
      devices: devices.map(d => d.id),
      capabilities: [{ type: 'devices.capabilities.on_off', retrievable: true, reportable: true, state: { instance: 'on', value: allOn } }],
    } as YandexGroup;
  });
};
