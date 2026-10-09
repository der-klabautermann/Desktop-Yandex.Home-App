import React, { useState } from 'react';
import { ArrowLeft, Loader2, Power, Trash2, Zap } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import { useDashboardContext } from '../contexts/DashboardContext';
import { useI18n } from '../i18n/I18nContext';
import { findNode } from '../../core/zones';
import { Pinned } from './Pinned';
import { ZoneIcon } from './zones/zoneIcons';
import { DeviceControlsSection, DeviceReadingsSection } from './device/DeviceSections';
import { deviceTypeLabel, formatPropertyValue } from '../utils/deviceInfo';

/** Страница устройства: управление, показания, сведения об устройстве и удаление. */
export const DashboardDeviceView: React.FC<{ deviceId: string | null }> = ({ deviceId }) => {
    const ctx = useDashboardContext();
    const { t, lang } = useI18n();
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const device = deviceId ? ctx.data.devices.find(d => d.id === deviceId) : undefined;
    if (!device) return <div className="empty-state"><p>{t('devicePage.notFound')}</p></div>;

    const unreachable = Boolean(device.unreachable);
    const onOff = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    const isOn = onOff?.state?.value === true;
    const power = (device.properties ?? []).find((p: any) => (p.parameters?.instance ?? p.state?.instance) === 'power');
    const room = ctx.data.rooms.find(r => r.id === device.room);
    const roomNode = device.room ? findNode(ctx.zones.tree, device.room) : undefined;
    const household = ctx.households.find(h => h.id === (device.household_id ?? room?.household_id));
    const providerId = device.provider_id ?? 'yandex';
    const service = t(`services.names.${providerId}`);
    const canDelete = ctx.deletableProviders.includes(providerId) && !unreachable;
    const info = (device as any).device_info as { manufacturer?: string; model?: string; hw_version?: string; sw_version?: string } | undefined;

    const toggle = async () => {
        setBusy(true);
        try { await ctx.onToggleDevice(device.id, isOn); } catch { /* сообщение уже показано */ } finally { setBusy(false); }
    };

    const remove = async () => {
        const deleted = await ctx.onDeleteDevice(device.id);
        setConfirming(false);
        if (deleted) ctx.onBack();
    };

    const rows: Array<[string, React.ReactNode]> = [
        [t('devicePage.type'), deviceTypeLabel(device.type, t)],
        [t('devicePage.room'), room ? (
            <span className="dp-room">
                <ZoneIcon icon={roomNode?.icon} kind="room" className="w-3.5 h-3.5" />{room.name}
            </span>
        ) : t('dashboard.noRoom')],
        ...(household ? [[t('devicePage.home'), household.name] as [string, React.ReactNode]] : []),
        [t('devicePage.service'), unreachable ? `${service} (${t('services.status.offline')})` : service],
        ...(info?.manufacturer ? [[t('devicePage.manufacturer'), info.manufacturer] as [string, React.ReactNode]] : []),
        ...(info?.model ? [[t('devicePage.model'), info.model] as [string, React.ReactNode]] : []),
        ...(info?.hw_version ? [[t('devicePage.hardware'), info.hw_version] as [string, React.ReactNode]] : []),
        ...(info?.sw_version ? [[t('devicePage.software'), info.sw_version] as [string, React.ReactNode]] : []),
        [t('devicePage.id'), <code key="id">{device.id.replace(/^[a-z]+:/, '')}</code>],
    ];

    return (
        <>
            <Pinned>
                <div className="zone-overview">
                    <button className="zone-edit dp-back" onClick={ctx.onBack}>
                        <ArrowLeft className="w-4 h-4" /> {t('devicePage.back')}
                    </button>
                    {onOff && (
                        <button className={`zone-control ${isOn && !unreachable ? 'is-on' : ''}`} disabled={busy || unreachable} onClick={toggle}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                            <span>{isOn ? t('cards.on') : t('cards.off')}</span>
                        </button>
                    )}
                    {power && (
                        <span className="zone-fact" title={t('sensors.power')}>
                            <Zap className="w-4 h-4" />{formatPropertyValue(power, t, lang)}
                        </span>
                    )}
                </div>
            </Pinned>

            <div className="device-page">
                <div className="dd-body dp-column">
                    <DeviceControlsSection device={device} />
                    <DeviceReadingsSection device={device} />
                </div>
                <div className="dd-body dp-column">
                    <section>
                        <h3>{t('devicePage.info')}</h3>
                        <dl className="dp-info">
                            {rows.map(([label, value]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                    <section className="dp-danger">
                        <button
                            className="zone-delete dp-delete"
                            disabled={!canDelete}
                            title={canDelete ? undefined : t('devicePage.deleteUnsupported', { service })}
                            onClick={() => setConfirming(true)}
                        >
                            <Trash2 className="w-4 h-4" /> {t('devicePage.delete')}
                        </button>
                    </section>
                </div>
            </div>

            {confirming && (
                <ConfirmDialog
                    title={t('devicePage.delete')}
                    text={t('devicePage.deleteConfirm', { name: device.name, service })}
                    confirmLabel={t('devicePage.deleteYes')}
                    onConfirm={remove}
                    onClose={() => setConfirming(false)}
                />
            )}
        </>
    );
};
