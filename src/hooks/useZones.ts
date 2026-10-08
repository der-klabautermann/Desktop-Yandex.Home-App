import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EMPTY_ZONE_CONFIG, addZone, buildZoneTree, moveNode, removeZone, renameZone, setZoneIcon,
  type ZoneConfig, type ZoneNode,
} from '../../core/zones';
import type { YandexUserInfoResponse } from '../types/index';

export interface UseZonesReturn {
  config: ZoneConfig;
  /** Дерево зон активного дома. */
  tree: ZoneNode[];
  createZone: (name: string, icon: string, parentId: string | null) => string | null;
  updateZone: (id: string, changes: { name?: string; icon?: string; parentId?: string | null }) => void;
  deleteZone: (id: string) => void;
}

/** Собственные зоны (этажи и т. п.): загрузка, сохранение и дерево для активного дома. */
export function useZones(userData: YandexUserInfoResponse | null, householdId: string | null): UseZonesReturn {
  const [config, setConfig] = useState<ZoneConfig>(EMPTY_ZONE_CONFIG);

  useEffect(() => {
    window.api?.zones?.load()
      .then(saved => { if (saved?.version === 1) setConfig(saved); })
      .catch(() => {});
  }, []);

  const commit = useCallback((next: ZoneConfig) => {
    setConfig(next);
    window.api?.zones?.save(next).catch(err => console.error('Zones save failed', err));
  }, []);

  const effectiveHousehold = householdId ?? userData?.households[0]?.id ?? null;

  const tree = useMemo(
    () => (userData ? buildZoneTree(userData, config, effectiveHousehold) : []),
    [userData, config, effectiveHousehold],
  );

  const createZone = useCallback((name: string, icon: string, parentId: string | null) => {
    if (!effectiveHousehold || !name.trim()) return null;
    const { config: next, id } = addZone(config, { name, icon, householdId: effectiveHousehold, parentId });
    commit(next);
    return id;
  }, [config, commit, effectiveHousehold]);

  const updateZone = useCallback((id: string, changes: { name?: string; icon?: string; parentId?: string | null }) => {
    let next = config;
    if (changes.name !== undefined) next = renameZone(next, id, changes.name);
    if (changes.icon !== undefined) next = setZoneIcon(next, id, changes.icon);
    if (changes.parentId !== undefined) next = moveNode(next, id, changes.parentId);
    commit(next);
  }, [config, commit]);

  const deleteZone = useCallback((id: string) => commit(removeZone(config, id)), [config, commit]);

  return { config, tree, createZone, updateZone, deleteZone };
}
