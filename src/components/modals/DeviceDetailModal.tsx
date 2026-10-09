import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, Loader2, Palette, Power, Star, Video, X } from 'lucide-react';
import type { YandexDevice } from '../../types/index';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice, isCameraDevice, isSensorDevice, localizeMode, localizeUnit } from '../../constants';
import { ProviderBadge } from '../services/ProviderBadge';
import { InstanceIcon, capabilityLabel, formatAt, listProperties, listStates, propertyLabel } from '../../utils/deviceInfo';

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
    // Положение ползунка до отпускания, чтобы не слать команду на каждый пиксель
    const [drafts, setDrafts] = useState<Record<string, number>>({});

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const onOff = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    const isOn = onOff?.state?.value === true;
    const unreachable = Boolean(device.unreachable);
    const room = ctx.data.rooms.find(r => r.id === device.room)?.name;
    const isFavorite = ctx.favoriteDeviceIds.includes(device.id);
    const properties = listProperties(device, t, lang);
    const states = listStates(device, t, lang);
    const camera = isCameraDevice(device);
    const sensor = isSensorDevice(device) && properties.length > 0;

    const run = async (key: string, action: () => Promise<void>) => {
        setBusy(key);
        try { await action(); } catch { /* сообщение уже показано */ } finally { setBusy(null); }
    };

    const setValue = (instance: string, type: string, value: unknown) =>
        run(instance, () => ctx.onSetDeviceMode(device.id, [{ instance, value, type }], false));

    const renderControl = (capability: any) => {
        const instance: string = capability.state?.instance ?? capability.parameters?.instance;
        const disabled = unreachable || busy !== null;
        if (capability.type === 'devices.capabilities.range') {
            const { min = 0, max = 100, precision = 1 } = capability.parameters?.range ?? {};
            const current = drafts[instance] ?? Number(capability.state?.value ?? min);
            const commit = () => {
                if (drafts[instance] === undefined) return;
                void setValue(instance, capability.type, drafts[instance]);
                setDrafts(({ [instance]: _, ...rest }) => rest);
            };
            return (
                <input
                    type="range" className="dd-slider" min={min} max={max} step={precision} value={current} disabled={disabled}
                    style={{ ['--fill' as any]: `${((current - min) / (max - min || 1)) * 100}%` }}
                    onChange={e => setDrafts(d => ({ ...d, [instance]: Number(e.target.value) }))}
                    onPointerUp={commit} onKeyUp={commit}
                    aria-label={capabilityLabel(instance, t)}
                />
            );
        }
        if (capability.type === 'devices.capabilities.mode') {
            const modes: Array<{ value: string; name?: string }> = capability.parameters?.modes ?? [];
            return (
                <div className="dd-chips">
                    {modes.map(mode => (
                        <button
                            key={mode.value}
                            className={`dd-chip ${capability.state?.value === mode.value ? 'is-active' : ''}`}
                            disabled={disabled}
                            onClick={() => setValue(instance, capability.type, mode.value)}
                        >
                            {localizeMode(mode.value, mode.name, t)}
                        </button>
                    ))}
                </div>
            );
        }
        if (capability.type === 'devices.capabilities.toggle') {
            const checked = capability.state?.value === true;
            return (
                <button
                    role="switch" aria-checked={checked} aria-label={capabilityLabel(instance, t)}
                    className={`dd-switch ${checked ? 'is-on' : ''}`} disabled={disabled}
                    onClick={() => setValue(instance, capability.type, !checked)}
                ><span /></button>
            );
        }
        return null;
    };

    // Строки состояния в порядке умений устройства, с регулятором там, где он есть
    const stateRows = device.capabilities.flatMap(capability => {
        const instance: string | undefined = (capability.state as any)?.instance ?? (capability.parameters as any)?.instance;
        const row = states.find(s => s.instance === instance);
        if (!row) return [];
        return [{ capability, row }];
    });

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
                </div>

                <div className="dd-hero">
                    <div className={`dd-icon ${isOn && !unreachable ? 'is-on' : ''}`}>
                        {React.cloneElement(getIconForDevice(device.type) as React.ReactElement<{ className?: string }>, { className: 'w-9 h-9' })}
                    </div>
                    <h2>{device.name}</h2>
                    <div className="dd-room">
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
                    {stateRows.length > 0 && (
                        <section>
                            <h3>{t('modals.detail.controls')}</h3>
                            {stateRows.map(({ capability, row }) => {
                                const control = renderControl(capability);
                                const draft = drafts[row.instance];
                                const value = draft !== undefined
                                    ? `${draft.toLocaleString(lang)}${localizeUnit((capability.parameters as any)?.unit, t)}`
                                    : row.value;
                                const stacked = capability.type === 'devices.capabilities.range' || capability.type === 'devices.capabilities.mode';
                                return (
                                    <div key={row.instance} className={`dd-row ${stacked ? 'is-stacked' : ''}`}>
                                        <div className="dd-row-head">
                                            <span className="dd-row-icon"><InstanceIcon instance={row.instance} /></span>
                                            <span className="dd-row-label">{capabilityLabel(row.instance, t)}</span>
                                            {row.swatch && <span className="dd-swatch" style={{ background: row.swatch }} />}
                                            {capability.type !== 'devices.capabilities.mode' && capability.type !== 'devices.capabilities.toggle' && (
                                                <span className="dd-row-value">{value}</span>
                                            )}
                                            {capability.type === 'devices.capabilities.toggle' && control}
                                        </div>
                                        {stacked && control}
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    {properties.length > 0 && (
                        <section>
                            <h3>{t('modals.detail.readings')}</h3>
                            {properties.map(property => (
                                <div key={property.index} className="dd-reading">
                                    <span className="dd-reading-icon"><InstanceIcon instance={property.instance} className="w-5 h-5" /></span>
                                    <div className="dd-reading-text">
                                        <b>{property.value}</b>
                                        <span>
                                            {propertyLabel(property.instance, t)}
                                            {property.at !== null && <time>{formatAt(property.at, lang)}</time>}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};
