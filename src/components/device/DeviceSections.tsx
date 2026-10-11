import React, { useEffect, useState } from 'react';
import type { YandexDevice } from '../../types/index';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { localizeMode, localizeUnit } from '../../constants';
import { InstanceIcon, capabilityLabel, formatAt, listProperties, listStates, propertyLabel } from '../../utils/deviceInfo';

/** Регуляторы всех умений устройства кроме включения: ползунки, режимы, переключатели. */
export const DeviceControlsSection: React.FC<{ device: YandexDevice }> = ({ device }) => {
    const ctx = useDashboardContext();
    const { t, lang } = useI18n();
    const [busy, setBusy] = useState(false);
    // Положение ползунка до отпускания, чтобы не слать команду на каждый пиксель
    const [drafts, setDrafts] = useState<Record<string, number>>({});
    const unreachable = Boolean(device.unreachable);
    const states = listStates(device, t, lang);

    const setValue = async (instance: string, type: string, value: unknown) => {
        setBusy(true);
        try { await ctx.onSetDeviceMode(device.id, [{ instance, value, type }], false); }
        catch { /* сообщение уже показано */ }
        finally { setBusy(false); }
    };

    const renderControl = (capability: any) => {
        const instance: string = capability.state?.instance ?? capability.parameters?.instance;
        const disabled = unreachable || busy;
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

    const rows = device.capabilities.flatMap(capability => {
        const instance: string | undefined = (capability.state as any)?.instance ?? (capability.parameters as any)?.instance;
        const row = states.find(s => s.instance === instance);
        return row ? [{ capability, row }] : [];
    });
    if (rows.length === 0) return null;

    return (
        <section>
            <h3>{t('modals.detail.controls')}</h3>
            {rows.map(({ capability, row }) => {
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
    );
};

/** Все показания с временем последнего обновления. */
/** Электрические показания: пока они открыты, обновляем их каждые несколько секунд. */
const LIVE_INSTANCES = new Set(['power', 'voltage', 'amperage']);
const LIVE_INTERVAL = 5000;
/** Значение старше этого считаем устаревшим и помечаем. */
const STALE_MS = 5 * 60_000;

export const DeviceReadingsSection: React.FC<{ device: YandexDevice }> = ({ device }) => {
    const ctx = useDashboardContext();
    const { t, lang } = useI18n();
    const properties = listProperties(device, t, lang);
    const live = properties.some(p => LIVE_INSTANCES.has(p.instance)) && !device.unreachable;
    const onRefresh = ctx.onRefresh;
    useEffect(() => {
        if (!live) return;
        const timer = window.setInterval(() => { if (!document.hidden) onRefresh(true); }, LIVE_INTERVAL);
        return () => window.clearInterval(timer);
    }, [live, onRefresh]);
    if (properties.length === 0) return null;
    return (
        <section>
            <h3>{t('modals.detail.readings')}</h3>
            {properties.map(property => (
                <div key={property.index} className="dd-reading">
                    <span className="dd-reading-icon"><InstanceIcon instance={property.instance} className="w-5 h-5" /></span>
                    <div className="dd-reading-text">
                        <b>{property.value}</b>
                        <span>
                            {propertyLabel(property.instance, t)}
                            {property.at !== null && (
                                <time
                                    className={Date.now() - property.at > STALE_MS ? 'is-stale' : undefined}
                                    title={Date.now() - property.at > STALE_MS ? t('modals.detail.stale') : undefined}
                                >{formatAt(property.at, lang)}</time>
                            )}
                        </span>
                    </div>
                </div>
            ))}
        </section>
    );
};
