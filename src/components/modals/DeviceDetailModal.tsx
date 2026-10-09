import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, Loader2, Palette, Power, Settings, Star, Video, X } from 'lucide-react';
import type { YandexDevice } from '../../types/index';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice, isCameraDevice, isSensorDevice } from '../../constants';
import { ProviderBadge } from '../services/ProviderBadge';
import { listProperties } from '../../utils/deviceInfo';
import { findNode } from '../../../core/zones';
import { ZoneIcon } from '../zones/zoneIcons';
import { DeviceControlsSection, DeviceReadingsSection } from '../device/DeviceSections';

interface DeviceDetailModalProps {
    device: YandexDevice;
    onClose: () => void;
    /** Отдельные окна: цвет света, камера, вид карточки датчика. */
    onOpenControls: (device: YandexDevice) => void;
}

const hasColor = (device: YandexDevice) => device.capabilities.some(c => c.type === 'devices.capabilities.color_setting');

/** Окно устройства: включение, все умения с регуляторами и все показания с временем. */
export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, onClose, onOpenControls }) => {
    const ctx = useDashboardContext();
    const { t, lang } = useI18n();
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const onOff = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    const isOn = onOff?.state?.value === true;
    const unreachable = Boolean(device.unreachable);
    const roomNode = device.room ? findNode(ctx.zones.tree, device.room) : undefined;
    const room = roomNode?.name ?? ctx.data.rooms.find(r => r.id === device.room)?.name;
    const isFavorite = ctx.favoriteDeviceIds.includes(device.id);
    const properties = listProperties(device, t, lang);
    const camera = isCameraDevice(device);
    const sensor = isSensorDevice(device) && properties.length > 0;

    const run = async (key: string, action: () => Promise<void>) => {
        setBusy(key);
        try { await action(); } catch { /* сообщение уже показано */ } finally { setBusy(null); }
    };

    return createPortal(
        <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="device-detail" role="dialog" aria-label={device.name}>
                <div className="dd-top">
                    <button className="header-btn" onClick={onClose} title={t('common.close')}><X className="w-4 h-4" /></button>
                    <span style={{ flex: 1 }} />
                    {sensor && (
                        <button className="header-btn" onClick={() => onOpenControls(device)} title={t('modals.sensor.title')}>
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        className={`header-btn dd-fav ${isFavorite ? 'is-fav' : ''}`}
                        onClick={() => ctx.onToggleDeviceFavorite(device.id)}
                        title={t('dashboard.favorites')}
                    >
                        <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button className="header-btn" onClick={() => { onClose(); ctx.onSelectDevice(device.id); }} title={t('devicePage.open')}>
                        <Settings className="w-4 h-4" />
                    </button>
                </div>

                <div className="dd-hero">
                    <div className={`dd-icon ${isOn && !unreachable ? 'is-on' : ''}`}>
                        {React.cloneElement(getIconForDevice(device.type) as React.ReactElement<{ className?: string }>, { className: 'w-9 h-9' })}
                    </div>
                    <h2>{device.name}</h2>
                    <div className="dd-room">
                        {!unreachable && roomNode && <ZoneIcon icon={roomNode.icon} kind="room" className="w-3.5 h-3.5" />}
                        {unreachable ? t('services.status.offline') : room}
                        <ProviderBadge providerId={device.provider_id} unreachable={unreachable} />
                    </div>
                    {(onOff || camera || hasColor(device)) && (
                        <div className="dd-actions">
                            {onOff && (
                                <button
                                    className={`dd-action dd-power ${isOn ? 'is-on' : ''}`}
                                    disabled={busy !== null}
                                    onClick={() => run('power', () => ctx.onToggleDevice(device.id, isOn))}
                                    title={isOn ? t('cards.turnOff') : t('cards.turnOn')}
                                >
                                    {busy === 'power' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className="w-6 h-6" />}
                                </button>
                            )}
                            {hasColor(device) && (
                                <button className="dd-action" disabled={unreachable} onClick={() => onOpenControls(device)} title={t('modals.light.title')}>
                                    <Palette className="w-6 h-6" />
                                </button>
                            )}
                            {camera && (
                                <button className="dd-action" disabled={unreachable} onClick={() => onOpenControls(device)} title={t('cards.tapToView')}>
                                    <Video className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="dd-body">
                    <DeviceControlsSection device={device} />
                    <DeviceReadingsSection device={device} />
                </div>
            </div>
        </div>,
        document.body,
    );
};
