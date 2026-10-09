import React, { useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { YandexDevice, YandexGroup } from '../types/index';
import { GroupCard } from './cards/GroupCard';
import { DeviceCardAdapter } from './cards/DeviceCardAdapter';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { isLightGroup } from '../constants';
import { useI18n } from '../i18n/I18nContext';
import { findNode, isZoneActive, summarizeDevices, type ZoneNode } from '../../core/zones';
import { ZoneIcon } from './zones/zoneIcons';
import { ZoneDialog } from './zones/ZoneDialog';
import { ZoneControls } from './zones/ZoneControls';

interface DashboardZoneViewProps {
    state: UseDashboardStateReturn;
    activeRoomId: string | null;
    groupsForHome: YandexGroup[];
    devicesForHome: YandexDevice[];
}

/** Комната или собственная зона: сводка, общие выключатели, устройства по вложенным комнатам. */
export const DashboardZoneView: React.FC<DashboardZoneViewProps> = ({
    state,
    activeRoomId,
    groupsForHome,
    devicesForHome,
}) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);

    const node = activeRoomId ? findNode(ctx.zones.tree, activeRoomId) : undefined;
    const devicesById = useMemo(() => new Map(devicesForHome.map(d => [d.id, d])), [devicesForHome]);
    const pick = (ids: string[]) => ids.map(id => devicesById.get(id)).filter(Boolean) as YandexDevice[];

    if (!activeRoomId) return null;
    if (!node) return <div className="empty-state"><p>{t('dashboard.roomNotFound')}</p></div>;

    const zoneDevices = pick(node.allDeviceIds);

    const renderDevices = (devices: YandexDevice[]) => {
        const groupedIds = new Set(
            groupsForHome.filter(g => g.devices.some(id => devices.some(d => d.id === id))).flatMap(g => g.devices)
        );
        const standalone = devices.filter(d => !groupedIds.has(d.id));
        const groups = groupsForHome.filter(g => g.devices.some(id => devices.some(d => d.id === id)));
        return (
            <>
                {standalone.length > 0 && (
                    <div className="device-grid" style={{ marginBottom: 16 }}>
                        {standalone.map(dev => (
                            <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} sensorDisplayConfig={state.sensorDisplayConfig} />
                        ))}
                    </div>
                )}
                {groups.map(group => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        devices={devicesForHome}
                        onToggleGroup={ctx.onToggleGroup}
                        onToggleDevice={ctx.onToggleDevice}
                        favoriteDeviceIds={ctx.favoriteDeviceIds}
                        onToggleDeviceFavorite={ctx.onToggleDeviceFavorite}
                        isFavorite={ctx.favoriteGroupIds.includes(group.id)}
                        onToggleFavorite={ctx.onToggleGroupFavorite}
                        onOpenSettings={state.handleOpenDeviceSettings}
                        onOpenCameraStream={state.openCameraStream}
                        onOpenGroupSettings={(g) => {
                            const gDevices = devicesForHome.filter(d => g.devices.includes(d.id));
                            if (isLightGroup(gDevices)) state.openGroupLightSettings(g);
                            else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.thermostat.ac' || d.type === 'devices.types.thermostat')) state.openGroupThermostatSettings(g);
                            else if (gDevices.length > 0 && gDevices.every(d => d.type === 'devices.types.ventilation.fan')) state.openGroupFanSettings(g);
                        }}
                    />
                ))}
            </>
        );
    };

    const renderChild = (child: ZoneNode) => {
        const devices = pick(child.allDeviceIds);
        if (devices.length === 0) return null;
        const active = isZoneActive(summarizeDevices(devices));
        return (
            <section key={child.id} className="room-section">
                <button className="room-header zone-child-header" onClick={() => ctx.onSelectRoom(child.id)}>
                    <ZoneIcon icon={child.icon} kind={child.kind} className="w-4 h-4" />
                    <h2>{child.name}</h2>
                    {active && <span className="zone-active-dot" title={t('zones.active')} />}
                    <span className="room-count">{devices.length}</span>
                </button>
                {renderDevices(devices)}
            </section>
        );
    };

    return (
        <>
            <ZoneControls
                devices={zoneDevices}
                scopeId={node.id}
                scopeName={node.name}
                state={state}
                trailing={
                    <button className="zone-edit" onClick={() => setEditing(true)}>
                        <Settings2 className="w-4 h-4" /> {t('zones.edit')}
                    </button>
                }
            />

            {node.deviceIds.length > 0 && renderDevices(pick(node.deviceIds))}
            {node.children.map(renderChild)}
            {zoneDevices.length === 0 && <div className="empty-state"><p>{t('zones.empty')}</p></div>}

            {editing && <ZoneDialog mode="edit" nodeId={node.id} onClose={() => setEditing(false)} />}
        </>
    );
};
