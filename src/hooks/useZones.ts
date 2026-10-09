import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_ZONE_CONFIG, addZone, applyDeviceOverrides, buildZoneTree, moveNode, removeZone, renameZone, setDeviceName, setDeviceRoom, setZoneIcon,
  type ZoneConfig, type ZoneNode,
} from '../../core/zones';
import { addGroup, customGroupsAsYandex, removeGroup, updateGroup } from '../../core/groups';
import type { YandexDevice, YandexGroup, YandexUserInfoResponse } from '../types/index';

export interface UseZonesReturn {
  config: ZoneConfig;
  /** Дерево зон активного дома. */
  tree: ZoneNode[];
  createZone: (name: string, icon: string, parentId: string | null) => string | null;
  updateZone: (id: string, changes: { name?: string; icon?: string; parentId?: string | null }) => void;
  deleteZone: (id: string) => void;
  /** Собственные группы всех домов в формате групп сервисов. */
  customGroups: YandexGroup[];
  createGroup: (name: string, deviceIds: string[]) => string | null;
  editGroup: (id: string, changes: { name?: string; deviceIds?: string[] }) => void;
  deleteGroup: (id: string) => void;
  /** Дом со своими названиями и комнатами устройств. */
  home: YandexUserInfoResponse | null;
  /** Устройство как его видит сервис (без своих названий и комнат). */
  originalDevice: (id: string) => YandexDevice | undefined;
  renameDevice: (id: string, name: string) => void;
  /** null: комната из сервиса. */
  moveDevice: (id: string, roomOrZoneId: string | null) => void;
}

/** Собственные зоны (этажи и т. п.): загрузка, сохранение и дерево для активного дома. */
export function useZones(userData: YandexUserInfoResponse | null, householdId: string | null): UseZonesReturn {
  const [config, setConfig] = useState<ZoneConfig>(EMPTY_ZONE_CONFIG);

  useEffect(() => {
    window.api?.zones?.load()
      .then(saved => { if (saved?.version === 1) setConfig(saved); })
      .catch(() => {});
  }, []);

  // Каждое изменение строится на самой свежей конфигурации: два изменения подряд
  // (новая зона и сразу перенос в неё устройства) не затирают друг друга
  const latest = useRef<ZoneConfig>(EMPTY_ZONE_CONFIG);
  useEffect(() => { latest.current = config; }, [config]);
  const update = useCallback((change: (current: ZoneConfig) => ZoneConfig) => {
    const next = change(latest.current);
    latest.current = next;
    setConfig(next);
    window.api?.zones?.save(next).catch(err => console.error('Zones save failed', err));
  }, []);

  const effectiveHousehold = householdId ?? userData?.households[0]?.id ?? null;

  const home = useMemo(() => (userData ? applyDeviceOverrides(userData, config) : null), [userData, config]);

  const tree = useMemo(
    () => (home ? buildZoneTree(home, config, effectiveHousehold) : []),
    [home, config, effectiveHousehold],
  );

  const createZone = useCallback((name: string, icon: string, parentId: string | null) => {
    if (!effectiveHousehold || !name.trim()) return null;
    const { config: next, id } = addZone(latest.current, { name, icon, householdId: effectiveHousehold, parentId });
    update(() => next);
    return id;
  }, [update, effectiveHousehold]);

  const updateZone = useCallback((id: string, changes: { name?: string; icon?: string; parentId?: string | null }) => {
    update(current => {
      let next = current;
      if (changes.name !== undefined) next = renameZone(next, id, changes.name);
      if (changes.icon !== undefined) next = setZoneIcon(next, id, changes.icon);
      if (changes.parentId !== undefined) next = moveNode(next, id, changes.parentId);
      return next;
    });
  }, [update]);

  const deleteZone = useCallback((id: string) => update(current => removeZone(current, id)), [update]);

  const customGroups = useMemo(
    () => (home ? customGroupsAsYandex(config, home) : []),
    [home, config],
  );

  const originalDevice = useCallback((id: string) => userData?.devices.find(d => d.id === id), [userData]);
  const renameDevice = useCallback((id: string, name: string) => update(current => setDeviceName(current, id, name)), [update]);
  const moveDevice = useCallback((id: string, room: string | null) => {
    // Выбрали комнату из сервиса: своя запись больше не нужна
    const original = userData?.devices.find(d => d.id === id)?.room ?? null;
    update(current => setDeviceRoom(current, id, room === original ? null : room));
  }, [update, userData]);

  const createGroup = useCallback((name: string, deviceIds: string[]) => {
    if (!effectiveHousehold || !name.trim() || deviceIds.length === 0) return null;
    const { config: next, id } = addGroup(latest.current, { name, householdId: effectiveHousehold, deviceIds });
    update(() => next);
    return id;
  }, [update, effectiveHousehold]);

  const editGroup = useCallback(
    (id: string, changes: { name?: string; deviceIds?: string[] }) => update(current => updateGroup(current, id, changes)),
    [update],
  );

  const deleteGroup = useCallback((id: string) => update(current => removeGroup(current, id)), [update]);

  return {
    config, tree, createZone, updateZone, deleteZone, customGroups, createGroup, editGroup, deleteGroup,
    home, originalDevice, renameDevice, moveDevice,
  };
}
