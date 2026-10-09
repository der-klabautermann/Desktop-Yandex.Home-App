import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { YandexDevice } from '../../types/index';
import type { ProviderId } from '../../types/electron-api';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice } from '../../constants';
import { findNode } from '../../../core/zones';
import { deviceTypeLabel } from '../../utils/deviceInfo';
import { ZoneIcon } from '../zones/zoneIcons';
import { ConfirmDialog } from '../ConfirmDialog';

interface ProviderDevicesProps {
    providerId: ProviderId;
    onAdd: () => void;
    onOpenDevice: (deviceId: string) => void;
}

/** Все устройства одного сервиса по комнатам: открыть, удалить, добавить новое. */
export const ProviderDevices: React.FC<ProviderDevicesProps> = ({ providerId, onAdd, onOpenDevice }) => {
    const ctx = useDashboardContext();
    const { t, tp } = useI18n();
    const [deleting, setDeleting] = useState<YandexDevice | null>(null);
    const canDelete = ctx.deletableProviders.includes(providerId);
    const service = t(`services.names.${providerId}`);

    const sections = useMemo(() => {
        const mine = ctx.data.devices.filter(d => (d.provider_id ?? 'yandex') === providerId);
        const byRoom = new Map<string, YandexDevice[]>();
        for (const device of mine) {
            const key = device.room ?? '';
            byRoom.set(key, [...(byRoom.get(key) ?? []), device]);
        }
        return [...byRoom.entries()]
            .map(([roomId, devices]) => ({
                roomId,
                name: findNode(ctx.zones.tree, roomId)?.name ?? ctx.data.rooms.find(r => r.id === roomId)?.name ?? t('dashboard.noRoom'),
                icon: roomId ? findNode(ctx.zones.tree, roomId)?.icon : undefined,
                devices: devices.sort((a, b) => a.name.localeCompare(b.name)),
            }))
            .sort((a, b) => (a.roomId ? 0 : 1) - (b.roomId ? 0 : 1) || a.name.localeCompare(b.name));
    }, [ctx.data.devices, ctx.data.rooms, ctx.zones.tree, providerId, t]);

    const total = sections.reduce((sum, s) => sum + s.devices.length, 0);

    return (
        <div className="provider-devices">
            <div className="provider-devices-bar">
                <span className="provider-devices-count">{tp('addDevice.count', total)}</span>
                <span style={{ flex: 1 }} />
                <button className="connect-primary zone-save" onClick={onAdd}>
                    <Plus className="w-4 h-4" /> {t('addDevice.title')}
                </button>
            </div>

            {total === 0 && <div className="empty-state"><p>{t('addDevice.emptyService')}</p></div>}

            {sections.map(section => (
                <section key={section.roomId || 'none'} className="provider-room">
                    <h3>
                        {section.roomId && <ZoneIcon icon={section.icon} kind="room" className="w-4 h-4" />}
                        {section.name}
                        <span className="room-count">{section.devices.length}</span>
                    </h3>
                    {section.devices.map(device => (
                        <div key={device.id} className={`provider-device ${device.unreachable ? 'is-unreachable' : ''}`}>
                            <button className="provider-device-main" onClick={() => onOpenDevice(device.id)}>
                                <span className="provider-device-icon">{getIconForDevice(device.type)}</span>
                                <span className="provider-device-text">
                                    <strong>{device.name}</strong>
                                    <small>{deviceTypeLabel(device.type, t)}</small>
                                </span>
                                <ChevronRight className="w-4 h-4 provider-device-chevron" />
                            </button>
                            <button
                                className="provider-device-delete"
                                disabled={!canDelete || device.unreachable}
                                title={canDelete ? t('devicePage.delete') : t('devicePage.deleteUnsupported', { service })}
                                aria-label={t('devicePage.delete')}
                                onClick={() => setDeleting(device)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </section>
            ))}

            {deleting && (
                <ConfirmDialog
                    title={t('devicePage.delete')}
                    text={t('devicePage.deleteConfirm', { name: deleting.name, service })}
                    confirmLabel={t('devicePage.deleteYes')}
                    onConfirm={async () => { await ctx.onDeleteDevice(deleting.id); setDeleting(null); }}
                    onClose={() => setDeleting(null)}
                />
            )}
        </div>
    );
};
