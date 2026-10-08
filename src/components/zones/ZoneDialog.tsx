import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { findNode, flattenTree, isCustomZoneId } from '../../../core/zones';
import { ZONE_ICONS, ZoneIcon } from './zoneIcons';

interface ZoneDialogProps {
  mode: 'create' | 'edit';
  /** Комната или зона, которую редактируем (для mode='edit'). */
  nodeId?: string;
  onClose: () => void;
}

/** Создание и правка зоны: название, значок, куда входит, удаление. */
export const ZoneDialog: React.FC<ZoneDialogProps> = ({ mode, nodeId, onClose }) => {
  const ctx = useDashboardContext();
  const { t } = useI18n();
  const { zones } = ctx;
  const node = nodeId ? findNode(zones.tree, nodeId) : undefined;
  const isCustom = mode === 'create' || (nodeId ? isCustomZoneId(nodeId) : false);

  const [name, setName] = useState(node?.name ?? '');
  const [icon, setIcon] = useState(node?.icon ?? 'layers');
  const [parentId, setParentId] = useState<string>(nodeId ? zones.config.parents[nodeId] ?? '' : '');

  // Куда можно перенести: только собственные зоны, не сама зона и не её потомки
  const parentOptions = useMemo(() => {
    const blocked = new Set(node ? flattenTree([node]).map(n => n.id) : []);
    return flattenTree(zones.tree).filter(n => n.kind === 'zone' && !blocked.has(n.id));
  }, [zones.tree, node]);

  const save = () => {
    if (mode === 'create') {
      const id = zones.createZone(name, icon, parentId || null);
      if (id) ctx.onSelectRoom(id);
    } else if (nodeId) {
      zones.updateZone(nodeId, isCustom ? { name, icon, parentId: parentId || null } : { parentId: parentId || null });
    }
    onClose();
  };

  const remove = () => {
    if (!nodeId || !window.confirm(t('zones.deleteConfirm', { name: node?.name ?? '' }))) return;
    zones.deleteZone(nodeId);
    ctx.onSelectHome();
    onClose();
  };

  // Портал: у боковой панели есть backdrop-filter, внутри неё fixed-окно было бы зажато
  return createPortal(
    <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zone-dialog" role="dialog" aria-label={mode === 'create' ? t('zones.add') : t('zones.edit')}>
        <header>
          <h3>{mode === 'create' ? t('zones.add') : node?.name}</h3>
          <button className="header-btn" onClick={onClose} title={t('common.close')}><X className="w-4 h-4" /></button>
        </header>

        {isCustom ? (
          <>
            <label htmlFor="zone-name">{t('zones.name')}</label>
            <input id="zone-name" value={name} onChange={e => setName(e.target.value)} placeholder={t('zones.namePlaceholder')} autoFocus />
            <label>{t('zones.icon')}</label>
            <div className="zone-icon-grid">
              {Object.keys(ZONE_ICONS).map(key => (
                <button key={key} className={`zone-icon-choice ${icon === key ? 'is-active' : ''}`} onClick={() => setIcon(key)} title={key}>
                  <ZoneIcon icon={key} kind="zone" className="w-4 h-4" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="zone-dialog-hint">{t('zones.roomHint')}</p>
        )}

        <label htmlFor="zone-parent">{t('zones.parent')}</label>
        <select id="zone-parent" value={parentId} onChange={e => setParentId(e.target.value)}>
          <option value="">{t('zones.topLevel')}</option>
          {parentOptions.map(option => (
            <option key={option.id} value={option.id}>{' '.repeat(option.depth)}{option.name}</option>
          ))}
        </select>

        <footer>
          {mode === 'edit' && isCustom && (
            <button className="zone-delete" onClick={remove}><Trash2 className="w-3.5 h-3.5" /> {t('zones.delete')}</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="service-action" onClick={onClose}>{t('common.cancel')}</button>
          <button className="connect-primary zone-save" disabled={isCustom && !name.trim()} onClick={save}>{t('common.save')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
