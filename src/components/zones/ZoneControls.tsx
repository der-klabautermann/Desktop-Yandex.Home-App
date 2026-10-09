import React, { useState } from 'react';
import {
    AirVent, Blinds, CloudOff, DoorOpen, Droplets, Footprints, Lightbulb, Plug, SlidersHorizontal, Thermometer, Tv, Zap,
} from 'lucide-react';
import type { YandexDevice, YandexGroup } from '../../types/index';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../../hooks/useDashboardState';
import { useI18n } from '../../i18n/I18nContext';
import { Pinned } from '../Pinned';
import { isZoneActive, summarizeDevices, zoneCategories, type ZoneCategory, type ZoneCategoryKey } from '../../../core/zones';

const CATEGORY_ICONS: Record<ZoneCategoryKey, React.FC<{ className?: string }>> = {
    light: Lightbulb,
    socket: Plug,
    climate: AirVent,
    openable: Blinds,
    media: Tv,
};

const THERMOSTATS = ['devices.types.thermostat', 'devices.types.thermostat.ac'];
const hasLightSettings = (device: YandexDevice) =>
    device.capabilities.some(c => c.type === 'devices.capabilities.color_setting'
        || (c.type === 'devices.capabilities.range' && (c.parameters as any)?.instance === 'brightness'));

interface ZoneControlsProps {
    /** Устройства зоны или группы вместе с вложенными. */
    devices: YandexDevice[];
    /** ID зоны или группы: из него строится временная группа для окна настроек. */
    scopeId: string;
    scopeName: string;
    state: UseDashboardStateReturn;
    /** Кнопка справа (изменить зону или группу). */
    trailing?: React.ReactNode;
}

/** Общее управление по категориям и сводка: свет, розетки, климат, шторы, медиа, энергия, активность. */
export const ZoneControls: React.FC<ZoneControlsProps> = ({ devices, scopeId, scopeName, state, trailing }) => {
    const ctx = useDashboardContext();
    const { t, tp, lang } = useI18n();
    const [busy, setBusy] = useState<ZoneCategoryKey | null>(null);

    const now = Date.now();
    const summary = summarizeDevices(devices, now);
    const categories = zoneCategories(devices);
    const byId = new Map<string, YandexDevice>(devices.map(d => [d.id, d]));
    const number = (value: number) => value.toLocaleString(lang, { maximumFractionDigits: 1 });

    const switchAll = async (category: ZoneCategory) => {
        setBusy(category.key);
        try {
            await ctx.onSetPower(category.deviceIds, category.on === 0);
        } finally {
            setBusy(null);
        }
    };

    // Окна настроек групп работают по списку устройств, поэтому зона выдаёт себя за группу
    const asGroup = (key: ZoneCategoryKey, ids: string[]): YandexGroup => ({
        id: `scope:${key}:${scopeId}`, name: scopeName, household_id: '', devices: ids, capabilities: [],
    });

    const settingsFor = (category: ZoneCategory): (() => void) | null => {
        const reachable = category.deviceIds.map(id => byId.get(id)).filter((d): d is YandexDevice => !!d && !d.unreachable);
        if (reachable.length === 0) return null;
        if (category.key === 'light') {
            // Первое устройство задаёт возможности окна, поэтому вперёд те, что умеют яркость или цвет
            const adjustable = reachable.filter(hasLightSettings);
            if (adjustable.length === 0) return null;
            return () => state.openGroupLightSettings(asGroup('light', adjustable.map(d => d.id)));
        }
        if (category.key === 'climate') {
            if (reachable.every(d => THERMOSTATS.includes(d.type))) {
                return () => state.openGroupThermostatSettings(asGroup('climate', reachable.map(d => d.id)));
            }
            if (reachable.every(d => d.type === 'devices.types.ventilation.fan')) {
                return () => state.openGroupFanSettings(asGroup('climate', reachable.map(d => d.id)));
            }
        }
        return null;
    };

    const motionAgo = (() => {
        if (summary.motion || summary.lastMotion === null || !isZoneActive({ ...summary, openCount: 0 }, now)) return null;
        const minutes = Math.round((now - summary.lastMotion) / 60_000);
        if (minutes < 1) return null;
        return new Intl.RelativeTimeFormat(lang, { style: 'short', numeric: 'auto' }).format(-minutes, 'minute');
    })();

    return (
        <Pinned>
        <div className="zone-overview">
            {categories.map(category => {
                const Icon = CATEGORY_ICONS[category.key];
                const anyOn = category.on > 0;
                const openSettings = settingsFor(category);
                const label = t(`zones.categories.${category.key}`);
                return (
                    <div key={category.key} className={`zone-control-wrap ${anyOn ? 'is-on' : ''} ${openSettings ? 'has-settings' : ''}`}>
                        <button
                            className={`zone-control ${anyOn ? 'is-on' : ''}`}
                            disabled={busy !== null}
                            onClick={() => switchAll(category)}
                            title={anyOn ? t('zones.allOff', { name: label }) : t('zones.allOn', { name: label })}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                            <b>{category.on}/{category.total}</b>
                        </button>
                        {openSettings && (
                            <button
                                className={`zone-control zone-control-more ${anyOn ? 'is-on' : ''}`}
                                disabled={busy !== null}
                                onClick={openSettings}
                                title={t('zones.adjust', { name: label })}
                                aria-label={t('zones.adjust', { name: label })}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                );
            })}
            {summary.power !== null && (
                <span className="zone-fact" title={t('zones.power')}><Zap className="w-4 h-4" />{number(summary.power)} W</span>
            )}
            {summary.temperature !== null && (
                <span className="zone-fact"><Thermometer className="w-4 h-4" />{number(summary.temperature)} °C</span>
            )}
            {summary.humidity !== null && (
                <span className="zone-fact"><Droplets className="w-4 h-4" />{number(summary.humidity)} %</span>
            )}
            {summary.motion && (
                <span className="zone-fact is-active"><Footprints className="w-4 h-4" />{t('zones.motion')}</span>
            )}
            {motionAgo && (
                <span className="zone-fact is-active" title={t('zones.lastMotion')}><Footprints className="w-4 h-4" />{motionAgo}</span>
            )}
            {summary.openCount > 0 && (
                <span className="zone-fact is-active"><DoorOpen className="w-4 h-4" />{tp('zones.open', summary.openCount)}</span>
            )}
            {summary.unreachable > 0 && (
                <span className="zone-fact is-warn"><CloudOff className="w-4 h-4" />{tp('zones.unreachable', summary.unreachable)}</span>
            )}
            {trailing && <><span style={{ flex: 1 }} />{trailing}</>}
        </div>
        </Pinned>
    );
};
