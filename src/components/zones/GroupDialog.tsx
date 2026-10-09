import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, X } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice } from '../../constants/icons';
import { flattenTree } from '../../../core/zones';
import { isGroupable } from '../../../core/groups';
import { ProviderBadge } from '../services/ProviderBadge';
import type { YandexDevice } from '../../types/index';

interface GroupDialogProps {
  mode: 'create' | 'edit';
  /** Собственная группа, которую правим (для mode='edit'). */
  groupId?: string;
  onClose: () => void;
}

/** Собственная группа: название и устройства любых сервисов, разложенные по комнатам. */
export const GroupDialog: React.FC<GroupDialogProps> = ({ mode, groupId, onClose }) => {
  const ctx = useDashboardContext();
  const { t } = useI18n();
  const existing = groupId ? ctx.zones.customGroups.find(g => g.id === groupId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(existing?.devices ?? []));

  // Комнаты в порядке дерева зон, внутри только то, что умеет включаться
  const sections = useMemo(() => {
    const byId = new Map(ctx.data.devices.map(d => [d.id, d]));
    const placed = new Set<string>();
    const result: Array<{ id: string; name: string; devices: YandexDevice[] }> = [];
    for (const node of flattenTree(ctx.zones.tree)) {
      const devices = node.deviceIds.map(id => byId.get(id)).filter((d): d is YandexDevice => !!d && isGroupable(d));
      devices.forEach(d => placed.add(d.id));
      if (devices.length) result.push({ id: node.id, name: node.name, devices });
    }
    const rest = ctx.data.devices.filter(d => !placed.has(d.id) && isGroupable(d)
      && (!ctx.activeHouseholdId || (d as any).household_id === ctx.activeHouseholdId));
    if (rest.length) result.push({ id: '', name: t('zones.noRoom'), devices: rest });
    return result;
  }, [ctx.data.devices, ctx.zones.tree, ctx.activeHouseholdId, t]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const canSave = name.trim().length > 0 && selected.size > 0;

  const save = () => {
    if (!canSave) return;
    if (mode === 'create') {
      const id = ctx.zones.createGroup(name, [...selected]);
      if (id) ctx.onSelectGroup(id);
    } else if (groupId) {
      ctx.zones.editGroup(groupId, { name, deviceIds: [...selected] });
    }
    onClose();
  };

  const remove = () => {
    if (!groupId || !window.confirm(t('zones.groupDeleteConfirm', { name: existing?.name ?? '' }))) return;
    ctx.zones.deleteGroup(groupId);
    ctx.onSelectHome();
    onClose();
  };

  return createPortal(
    <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zone-dialog" role="dialog" aria-label={mode === 'create' ? t('zones.groupAdd') : existing?.name}>
        <header>
          <h3>{mode === 'create' ? t('zones.groupAdd') : existing?.name}</h3>
          <button className="header-btn" onClick={onClose} title={t('common.close')}><X className="w-4 h-4" /></button>
        </header>

        <label htmlFor="group-name">{t('zones.name')}</label>
        <input
          id="group-name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          autoFocus
        />

        <label>
          {t('zones.groupDevices')}
          {selected.size > 0 && <span className="group-pick-count">{selected.size}</span>}
        </label>
        <div className="group-pick-list">
          {sections.map(section => (
            <div key={section.id || 'rest'} className="group-pick-section">
              <div className="group-pick-room">{section.name}</div>
              {section.devices.map(device => {
                const isSelected = selected.has(device.id);
                return (
                  <button
                    key={device.id}
                    className={`group-pick-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => toggle(device.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="group-pick-icon">{getIconForDevice(device.type)}</span>
                    <span className="group-pick-name">{device.name}</span>
                    <ProviderBadge providerId={device.provider_id} unreachable={device.unreachable} />
                    <span className="group-pick-check">{isSelected && <Check className="w-3 h-3" strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <footer>
          {mode === 'edit' && (
            <button className="zone-delete" onClick={remove}><Trash2 className="w-3.5 h-3.5" /> {t('zones.groupDelete')}</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="service-action" onClick={onClose}>{t('common.cancel')}</button>
          <button className="connect-primary zone-save" disabled={!canSave} onClick={save}>{t('common.save')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
