import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { YandexGroup, YandexDevice } from '../types/index';
import { DeviceCard } from './cards/DeviceCard';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { useI18n } from '../i18n/I18nContext';
import { isCustomGroupId } from '../../core/groups';
import { ZoneControls } from './zones/ZoneControls';
import { GroupDialog } from './zones/GroupDialog';

interface DashboardGroupViewProps {
    state: UseDashboardStateReturn;
    activeGroupId: string | null;
    groupsForHome: YandexGroup[];
    devicesForHome: YandexDevice[];
}

export const DashboardGroupView: React.FC<DashboardGroupViewProps> = ({
    state,
    activeGroupId,
    groupsForHome,
    devicesForHome,
}) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);

    if (!activeGroupId) return null;
    const group = groupsForHome.find(g => g.id === activeGroupId);
    if (!group) return <div className="empty-state"><p>{t('dashboard.groupNotFound')}</p></div>;

    const groupDevices = devicesForHome.filter(d => group.devices.includes(d.id));
    const custom = isCustomGroupId(group.id);
    const editButton = custom ? (
        <button className="zone-edit" onClick={() => setEditing(true)}>
            <Settings2 className="w-4 h-4" /> {t('zones.groupEdit')}
        </button>
    ) : undefined;
    const dialog = editing && <GroupDialog mode="edit" groupId={group.id} onClose={() => setEditing(false)} />;

    if (groupDevices.length === 0) {
        return (
            <>
                {editButton && <div className="zone-overview">{editButton}</div>}
                <div className="empty-state"><p>{t('dashboard.groupEmpty')}</p></div>
                {dialog}
            </>
        );
    }

    return (
        <>
        <ZoneControls devices={groupDevices} scopeId={group.id} scopeName={group.name} state={state} trailing={editButton} />
        <div className="device-grid">
            {groupDevices.map(dev => (
                    <DeviceCard
                        key={dev.id}
                        device={dev}
                        onToggle={ctx.onToggleDevice}
                        isFavorite={ctx.favoriteDeviceIds.includes(dev.id)}
                        onToggleFavorite={ctx.onToggleDeviceFavorite}
                        onOpenSettings={state.handleOpenDeviceSettings}
                        onOpenCameraStream={state.openCameraStream}
                        sensorDisplayConfig={state.sensorDisplayConfig}
                    />
                ))}
        </div>
        {dialog}
        </>
    );
};
