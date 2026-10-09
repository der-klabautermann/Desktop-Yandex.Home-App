import React, { useState } from 'react';
import { ChevronRight, Droplets, Loader2, Plus, Power, SquareStack, Thermometer } from 'lucide-react';
import type { YandexDevice, YandexGroup, YandexScenario } from '../types/index';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { useI18n } from '../i18n/I18nContext';
import { isSensorDevice } from '../constants';
import { isZoneActive, summarizeDevices, type ZoneNode } from '../../core/zones';
import { Pinned } from './Pinned';
import { ZoneIcon } from './zones/zoneIcons';
import { ZoneDialog } from './zones/ZoneDialog';
import { GroupDialog } from './zones/GroupDialog';
import { DeviceCardAdapter } from './cards/DeviceCardAdapter';
import { ScenarioCard } from './cards/ScenarioCard';

const AddButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <Pinned>
        <div className="zone-overview">
            <button className="zone-edit" onClick={onClick}><Plus className="w-4 h-4" /> {label}</button>
        </div>
    </Pinned>
);

/** Температура и влажность комнаты, если в ней есть датчики. */
export const ClimateChip: React.FC<{ devices: YandexDevice[] }> = ({ devices }) => {
    const { lang } = useI18n();
    const summary = summarizeDevices(devices);
    if (summary.temperature === null && summary.humidity === null) return null;
    const number = (value: number) => value.toLocaleString(lang, { maximumFractionDigits: 1 });
    return (
        <span className="climate-chip">
            {summary.temperature !== null && <span><Thermometer className="w-3.5 h-3.5" />{number(summary.temperature)} °C</span>}
            {summary.humidity !== null && <span className="is-humidity"><Droplets className="w-3.5 h-3.5" />{number(summary.humidity)} %</span>}
        </span>
    );
};

/** «Комнаты и зоны»: карточка на каждую комнату, зоны (этажи) как заголовки. */
export const RoomsPage: React.FC<{ devicesForHome: YandexDevice[] }> = ({ devicesForHome }) => {
    const ctx = useDashboardContext();
    const { t, tp } = useI18n();
    const [creating, setCreating] = useState(false);
    const byId = new Map(devicesForHome.map(d => [d.id, d]));
    const pick = (ids: string[]) => ids.map(id => byId.get(id)).filter(Boolean) as YandexDevice[];

    const card = (node: ZoneNode) => {
        const devices = pick(node.allDeviceIds);
        const on = devices.filter(d => !d.unreachable && d.capabilities.some(c => c.type === 'devices.capabilities.on_off' && c.state?.value === true)).length;
        return (
            <button key={node.id} className="room-card" onClick={() => ctx.onSelectRoom(node.id)}>
                <span className="room-card-icon"><ZoneIcon icon={node.icon} kind={node.kind} className="w-5 h-5" /></span>
                <span className="room-card-text">
                    <strong>{node.name}</strong>
                    <small>{tp('dashboard.devicesOn', devices.length, { on })}</small>
                    <ClimateChip devices={devices} />
                </span>
                {isZoneActive(summarizeDevices(devices)) && <span className="zone-active-dot" title={t('zones.active')} />}
                <ChevronRight className="w-4 h-4 room-card-chevron" />
            </button>
        );
    };

    const render = (nodes: ZoneNode[], depth = 0): React.ReactNode => nodes.map(node => (node.kind === 'zone' ? (
        <section key={node.id} className="rooms-zone" style={{ marginLeft: depth * 14 }}>
            {card(node)}
            {node.children.length > 0 && <div className="rooms-grid">{render(node.children, depth + 1)}</div>}
        </section>
    ) : card(node)));

    return (
        <>
            <AddButton label={t('zones.add')} onClick={() => setCreating(true)} />
            <div className="rooms-grid">{render(ctx.zones.tree)}</div>
            {creating && <ZoneDialog mode="create" onClose={() => setCreating(false)} />}
        </>
    );
};

export const SensorsPage: React.FC<{ state: UseDashboardStateReturn; devicesForHome: YandexDevice[] }> = ({ state, devicesForHome }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const sensors = devicesForHome.filter(isSensorDevice).sort((a, b) => a.name.localeCompare(b.name));
    if (sensors.length === 0) return <div className="empty-state"><p>{t('dashboard.noSensors')}</p></div>;
    return (
        <div className="device-grid">
            {sensors.map(dev => (
                <DeviceCardAdapter key={dev.id} device={dev} onToggle={ctx.onToggleDevice} isFavorite={ctx.favoriteDeviceIds.includes(dev.id)} onToggleFavorite={ctx.onToggleDeviceFavorite} onOpenSettings={state.handleOpenDeviceSettings} onOpenCameraStream={state.openCameraStream} sensorDisplayConfig={state.sensorDisplayConfig} />
            ))}
        </div>
    );
};

const GroupTile: React.FC<{ group: YandexGroup; devices: YandexDevice[] }> = ({ group, devices }) => {
    const ctx = useDashboardContext();
    const { t, tp } = useI18n();
    const [busy, setBusy] = useState(false);
    const members = devices.filter(d => group.devices.includes(d.id));
    const on = members.filter(d => d.capabilities.some(c => c.type === 'devices.capabilities.on_off' && c.state?.value === true)).length;
    const allOn = members.length > 0 && on === members.length;
    const toggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setBusy(true);
        try { await ctx.onToggleGroup(group.id, allOn); } catch { /* сообщение уже показано */ } finally { setBusy(false); }
    };
    return (
        <div className={`room-card group-tile ${on > 0 ? 'is-on' : ''}`} role="button" tabIndex={0} onClick={() => ctx.onSelectGroup(group.id)}>
            <span className="room-card-icon"><SquareStack className="w-5 h-5" /></span>
            <span className="room-card-text">
                <strong>{group.name}</strong>
                <small>{tp('dashboard.devicesOn', members.length, { on })}</small>
            </span>
            <button className={`tile-power ${allOn ? 'is-on' : ''}`} onClick={toggle} disabled={busy} title={allOn ? t('cards.turnOff') : t('cards.turnOn')}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            </button>
        </div>
    );
};

export const GroupsPage: React.FC<{ groupsForHome: YandexGroup[]; devicesForHome: YandexDevice[] }> = ({ groupsForHome, devicesForHome }) => {
    const { t } = useI18n();
    const [creating, setCreating] = useState(false);
    return (
        <>
            <AddButton label={t('zones.groupAdd')} onClick={() => setCreating(true)} />
            {groupsForHome.length === 0 && <div className="empty-state"><p>{t('dashboard.noGroups')}</p></div>}
            <div className="rooms-grid">
                {groupsForHome.map(group => <GroupTile key={group.id} group={group} devices={devicesForHome} />)}
            </div>
            {creating && <GroupDialog mode="create" onClose={() => setCreating(false)} />}
        </>
    );
};

export const ScenariosPage: React.FC<{ scenarios: YandexScenario[] }> = ({ scenarios }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    if (scenarios.length === 0) return <div className="empty-state"><p>{t('dashboard.noScenarios')}</p></div>;
    return (
        <div className="scenario-grid">
            {scenarios.map(scenario => (
                <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onExecute={ctx.onExecuteScenario}
                    isFavorite={ctx.favoriteScenarioIds.includes(scenario.id)}
                    onToggleFavorite={ctx.onToggleScenarioFavorite}
                />
            ))}
        </div>
    );
};
