import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { isZoneActive, summarizeDevices, type ZoneNode } from '../../../core/zones';
import { ZoneIcon } from '../zones/zoneIcons';
import { ZoneDialog } from '../zones/ZoneDialog';

interface SidebarZonesProps {
    collapsed: boolean;
    onToggle: () => void;
}

const COLLAPSED_KEY = 'sidebar:collapsedZones';

const loadCollapsed = (): Set<string> => {
    try {
        return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
    } catch {
        return new Set();
    }
};

/** Дерево зон в боковой панели: этажи, комнаты, точка активности. */
export const SidebarZones: React.FC<SidebarZonesProps> = ({ collapsed, onToggle }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [closed, setClosed] = useState<Set<string>>(loadCollapsed);
    const [creating, setCreating] = useState(false);

    const devicesById = useMemo(() => new Map(ctx.data.devices.map(d => [d.id, d])), [ctx.data.devices]);

    const toggleNode = (id: string) => {
        setClosed(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* не сохранится */ }
            return next;
        });
    };

    const renderNode = (node: ZoneNode, depth: number): React.ReactNode => {
        const devices = node.allDeviceIds.map(id => devicesById.get(id)).filter(Boolean) as typeof ctx.data.devices;
        if (node.kind === 'room' && devices.length === 0 && node.children.length === 0) return null;
        const active = isZoneActive(summarizeDevices(devices));
        const hasChildren = node.children.length > 0;
        const isOpen = !closed.has(node.id);
        const isSelected = ctx.activeSidebarView === 'room' && ctx.activeRoomId === node.id;
        return (
            <React.Fragment key={node.id}>
                <button
                    className={`sidebar-item zone-item ${isSelected ? 'active' : ''} ${node.kind === 'zone' ? 'is-zone' : ''}`}
                    style={{ paddingLeft: 10 + depth * 14 }}
                    onClick={() => ctx.onSelectRoom(node.id)}
                >
                    {hasChildren ? (
                        <span className="zone-caret" onClick={e => { e.stopPropagation(); toggleNode(node.id); }}>
                            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </span>
                    ) : (
                        <span className="zone-caret" />
                    )}
                    <span className="sidebar-item-icon"><ZoneIcon icon={node.icon} kind={node.kind} /></span>
                    <span className="zone-item-name">{node.name}</span>
                    {active && <span className="zone-active-dot" title={t('zones.active')} />}
                    <span className="sidebar-item-badge">{devices.length}</span>
                </button>
                {hasChildren && isOpen && node.children.map(child => renderNode(child, depth + 1))}
            </React.Fragment>
        );
    };

    if (ctx.zones.tree.length === 0) return null;

    return (
        <>
            <div className="sidebar-section-title" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown className="w-3 h-3" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
                {t('zones.title')}
                <button
                    className="zone-add-inline"
                    title={t('zones.add')}
                    onClick={e => { e.stopPropagation(); setCreating(true); }}
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            {!collapsed && ctx.zones.tree.map(node => renderNode(node, 0))}
            {creating && <ZoneDialog mode="create" onClose={() => setCreating(false)} />}
        </>
    );
};
