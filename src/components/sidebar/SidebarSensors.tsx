import React, { useMemo } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { getIconForDevice, isSensorDevice } from '../../constants';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';

interface SidebarSensorsProps {
    collapsed: boolean;
    onToggle: () => void;
}

export const SidebarSensors: React.FC<SidebarSensorsProps> = ({ collapsed, onToggle }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();

    const roomsForHome = useMemo(() => {
        if (!ctx.activeHouseholdId) return ctx.data.rooms;
        return ctx.data.rooms.filter(room => room.household_id === ctx.activeHouseholdId);
    }, [ctx.data.rooms, ctx.activeHouseholdId]);

    const roomIdsForHome = useMemo(() => new Set(roomsForHome.map(r => r.id)), [roomsForHome]);

    const allSensors = useMemo(() => {
        const devicesForHome = !ctx.activeHouseholdId ? ctx.data.devices
            : ctx.data.devices.filter(device => {
                const anyDevice = device as any;
                if (anyDevice.household_id) return anyDevice.household_id === ctx.activeHouseholdId;
                if (device.room && roomIdsForHome.has(device.room)) return true;
                return false;
            });
        return devicesForHome.filter(d => isSensorDevice(d));
    }, [ctx.data.devices, ctx.activeHouseholdId, roomIdsForHome]);

    if (allSensors.length === 0) return null;

    return (
        <>
            <div className="sidebar-section-title" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown className="w-3 h-3" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
                {t('dashboard.sensors')}
                <span className="sidebar-item-badge">{allSensors.length}</span>
            </div>
            {!collapsed && allSensors.map(d => {
                const isFav = ctx.favoriteDeviceIds.includes(d.id);
                return (
                    <div key={d.id} className={`sidebar-item ${d.unreachable ? 'is-unreachable' : ''}`} style={{ paddingRight: '8px', opacity: 0.7 }}>
                        <span className="sidebar-item-icon">
                            {React.cloneElement(getIconForDevice(d.type) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })}
                        </span>
                        <span style={{ flex: 1, fontSize: 13 }}>
                            {d.name}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); ctx.onToggleDeviceFavorite(d.id); }}
                            className={isFav ? 'device-fav is-fav' : ''}
                            style={{
                                position: 'static',
                                ...(isFav ? {} : {
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--muted)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', padding: 2, flexShrink: 0,
                                }),
                            }}
                        >
                            <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                );
            })}
        </>
    );
};
