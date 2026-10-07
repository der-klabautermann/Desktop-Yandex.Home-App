import React, { useMemo } from 'react';
import { ChevronDown, SquareSquare } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';

interface SidebarRoomsProps {
    collapsed: boolean;
    onToggle: () => void;
}

export const SidebarRooms: React.FC<SidebarRoomsProps> = ({ collapsed, onToggle }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();

    const roomsForHome = useMemo(() => {
        if (!ctx.activeHouseholdId) return ctx.data.rooms;
        return ctx.data.rooms.filter(room => room.household_id === ctx.activeHouseholdId);
    }, [ctx.data.rooms, ctx.activeHouseholdId]);

    if (roomsForHome.length === 0) return null;

    const roomDeviceCount = (roomId: string) => {
        return ctx.data.devices.filter(d => d.room === roomId).length;
    };

    return (
        <>
            <div className="sidebar-section-title" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown className="w-3 h-3" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
                {t('sidebar.rooms')}
            </div>
            {!collapsed && roomsForHome.map(room => (
                <button
                    key={room.id}
                    className={`sidebar-item ${ctx.activeSidebarView === 'room' && ctx.activeRoomId === room.id ? 'active' : ''}`}
                    onClick={() => ctx.onSelectRoom(room.id)}
                >
                    <span className="sidebar-item-icon"><SquareSquare /></span>
                    {room.name}
                    <span className="sidebar-item-badge">{roomDeviceCount(room.id)}</span>
                </button>
            ))}
        </>
    );
};
