import React, { useMemo } from 'react';
import { YandexDevice } from '../../types/index';
import { ChevronDown, Star, Loader2 } from 'lucide-react';
import { getIconForScenario, getIconForDevice, isCameraDevice, isSensorDevice } from '../../constants';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';

interface SidebarFavoritesProps {
    collapsed: boolean;
    onToggle: () => void;
    loadingItems: Record<string, boolean>;
    withLoading: (key: string, action: () => Promise<void>) => () => void;
    onOpenCameraStream?: (device: YandexDevice) => void;
}

export const SidebarFavorites: React.FC<SidebarFavoritesProps> = ({
    collapsed, onToggle, loadingItems, withLoading, onOpenCameraStream,
}) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();

    // Household-aware filtering (same logic as Dashboard.tsx)
    const activeHouseholdId = ctx.activeHouseholdId;

    const roomsForHome = useMemo(() => {
        if (!activeHouseholdId) return ctx.data.rooms;
        return ctx.data.rooms.filter(room => room.household_id === activeHouseholdId);
    }, [ctx.data.rooms, activeHouseholdId]);

    const roomIdsForHome = useMemo(() => new Set(roomsForHome.map(r => r.id)), [roomsForHome]);

    const devicesForHome = useMemo(() => {
        if (!activeHouseholdId) return ctx.data.devices;
        return ctx.data.devices.filter(device => {
            const anyDevice = device as any;
            const deviceHouseholdId: string | undefined = anyDevice.household_id;
            if (deviceHouseholdId) return deviceHouseholdId === activeHouseholdId;
            if (device.room && roomIdsForHome.has(device.room)) return true;
            return false;
        });
    }, [ctx.data.devices, activeHouseholdId, roomIdsForHome]);

    const groupsForHome = useMemo(() => {
        if (!activeHouseholdId) return ctx.data.groups;
        return ctx.data.groups.filter(group => group.household_id === activeHouseholdId);
    }, [ctx.data.groups, activeHouseholdId]);

    const favoriteScenarios = useMemo(
        () => ctx.data.scenarios.filter(s => s.is_active && ctx.favoriteScenarioIds.includes(s.id)),
        [ctx.data.scenarios, ctx.favoriteScenarioIds]
    );

    const favoriteDevices = useMemo(
        () => devicesForHome.filter(d => ctx.favoriteDeviceIds.includes(d.id)),
        [devicesForHome, ctx.favoriteDeviceIds]
    );

    const favoriteGroups = useMemo(
        () => groupsForHome.filter(g => ctx.favoriteGroupIds.includes(g.id)),
        [groupsForHome, ctx.favoriteGroupIds]
    );

    const favoriteSensorDevices = useMemo(
        () => favoriteDevices.filter(d => isSensorDevice(d)).sort((a, b) => a.name.localeCompare(b.name)),
        [favoriteDevices]
    );

    const favoriteRegularDevices = useMemo(
        () => favoriteDevices.filter(d => !isSensorDevice(d)).sort((a, b) => a.name.localeCompare(b.name)),
        [favoriteDevices]
    );

    const hasFavorites = favoriteScenarios.length > 0 || favoriteDevices.length > 0 || favoriteGroups.length > 0;
    if (!hasFavorites) return null;

    return (
        <>
            <div className="sidebar-section-title" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown className="w-3 h-3" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
                {t('dashboard.favorites')}
            </div>
            {!collapsed && (<>
                {favoriteScenarios.map(s => (
                    <div key={s.id} className="sidebar-item" style={{ paddingRight: '8px' }}>
                        <span className="sidebar-item-icon">
                            {loadingItems[`scenario:${s.id}`]
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : React.cloneElement(getIconForScenario(s.icon, s.name) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                            }
                        </span>
                        <span
                            style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                            onClick={withLoading(`scenario:${s.id}`, () => ctx.onExecuteScenario(s.id))}
                        >{s.name}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); ctx.onToggleScenarioFavorite(s.id); }}
                            className="device-fav is-fav"
                            style={{ position: 'static', opacity: 1 }}
                        >
                            <Star className="w-3 h-3" fill="currentColor" />
                        </button>
                    </div>
                ))}
                {favoriteSensorDevices.slice(0, 5).map(d => {
                    const onOff = d.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
                    const isOn = onOff?.state?.value === true;
                    return (
                        <div key={d.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                            <span className="sidebar-item-icon">
                                {loadingItems[`device:${d.id}`]
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : React.cloneElement(getIconForDevice(d.type) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                                }
                            </span>
                            <span
                                style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                                onClick={withLoading(`device:${d.id}`, async () => {
                                    if (isCameraDevice(d) && onOpenCameraStream) {
                                        onOpenCameraStream(d);
                                        return;
                                    }
                                    await ctx.onToggleDevice(d.id, isOn);
                                })}
                            >
                                {d.name}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); ctx.onToggleDeviceFavorite(d.id); }}
                                className="device-fav is-fav"
                                style={{ position: 'static', opacity: 1 }}
                            >
                                <Star className="w-3 h-3" fill="currentColor" />
                            </button>
                        </div>
                    );
                })}
                {favoriteRegularDevices.slice(0, 5).map(d => {
                    const onOff = d.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
                    const isOn = onOff?.state?.value === true;
                    return (
                        <div key={d.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                            <span className="sidebar-item-icon">
                                {loadingItems[`device:${d.id}`]
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : React.cloneElement(getIconForDevice(d.type) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                                }
                            </span>
                            <span
                                style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                                onClick={withLoading(`device:${d.id}`, async () => {
                                    if (isCameraDevice(d) && onOpenCameraStream) {
                                        onOpenCameraStream(d);
                                        return;
                                    }
                                    await ctx.onToggleDevice(d.id, isOn);
                                })}
                            >
                                {d.name}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); ctx.onToggleDeviceFavorite(d.id); }}
                                className="device-fav is-fav"
                                style={{ position: 'static', opacity: 1 }}
                            >
                                <Star className="w-3 h-3" fill="currentColor" />
                            </button>
                        </div>
                    );
                })}
                {favoriteGroups.map(g => {
                    const onOff = g.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
                    const isOn = onOff?.state?.value === true;
                    return (
                        <div key={g.id} className="sidebar-item" style={{ paddingRight: '8px', opacity: 0.7 }}>
                            <span className="sidebar-item-icon">
                                {loadingItems[`group:${g.id}`]
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="7" height="7" />
                                        <rect x="14" y="3" width="7" height="7" />
                                        <rect x="3" y="14" width="7" height="7" />
                                        <rect x="14" y="14" width="7" height="7" />
                                    </svg>
                                }
                            </span>
                            <span
                                style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                                onClick={withLoading(`group:${g.id}`, () => ctx.onToggleGroup(g.id, isOn))}
                            >
                                {g.name}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); ctx.onToggleGroupFavorite(g.id); }}
                                className="device-fav is-fav"
                                style={{ position: 'static', opacity: 1 }}
                            >
                                <Star className="w-3 h-3" fill="currentColor" />
                            </button>
                        </div>
                    );
                })}
            </>)}
        </>
    );
};
