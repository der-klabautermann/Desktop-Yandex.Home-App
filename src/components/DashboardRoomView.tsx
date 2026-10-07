import React from 'react';
import { YandexRoom, YandexDevice, YandexGroup } from '../types/index';
import { GroupCard } from './cards/GroupCard';
import { DeviceCardAdapter } from './cards/DeviceCardAdapter';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { isLightGroup } from '../constants';
import { useI18n } from '../i18n/I18nContext';

interface DashboardRoomViewProps {
    state: UseDashboardStateReturn;
    activeRoomId: string | null;
    roomsForHome: YandexRoom[];
    groupsForHome: YandexGroup[];
    devicesForHome: YandexDevice[];
}

export const DashboardRoomView: React.FC<DashboardRoomViewProps> = ({
    state,
    activeRoomId,
    roomsForHome,
    groupsForHome,
    devicesForHome,
}) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();

    if (!activeRoomId) return null;
    const room = roomsForHome.find(r => r.id === activeRoomId);
    if (!room) return <div className="empty-state"><p>{t('dashboard.roomNotFound')}</p></div>;

    const roomDevices = devicesForHome.filter(d => room.devices.includes(d.id));
    if (roomDevices.length === 0) return <div className="empty-state"><p>{t('dashboard.roomEmpty')}</p></div>;

    const groupedDeviceIds = new Set(
        groupsForHome
            .filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)))
            .flatMap(g => g.devices)
    );
    const standaloneDevices = roomDevices.filter(d => !groupedDeviceIds.has(d.id));
    const roomGroups = groupsForHome.filter(g => g.devices.some(deviceId => roomDevices.some(d => d.id === deviceId)));

    return (
        <>
            {standaloneDevices.length > 0 && (
                <div className="device-grid" style={{ marginBottom: 16 }}>
                    {standaloneDevices.map(dev => (
                            <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} sensorDisplayConfig={state.sensorDisplayConfig} />
                        ))}
                </div>
            )}

            {roomGroups.map(group => (
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
