import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Play, SquareStack } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { getIconForDevice, isSensorDevice } from '../../constants';
import { flattenTree, isZoneActive, summarizeDevices } from '../../../core/zones';
import { ZoneIcon } from '../zones/zoneIcons';
import { formatPropertyValue } from '../../utils/deviceInfo';
import { useI18n } from '../../i18n/I18nContext';

type ListKey = 'rooms' | 'sensors' | 'groups' | 'scenarios';

/** Раскрывающийся список под пунктом меню: комнаты, датчики, группы или сценарии. */
export const SidebarSubList: React.FC<{ list: ListKey }> = ({ list }) => {
    const ctx = useDashboardContext();
    const { t, lang } = useI18n();
    const [running, setRunning] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const home = ctx.activeHouseholdId;
    const inHome = (householdId?: string) => !home || !householdId || householdId === home;
    const devicesById = useMemo(() => new Map(ctx.data.devices.map(d => [d.id, d])), [ctx.data.devices]);

    if (list === 'rooms') {
        return (
            <div className="nav-sub">
                {flattenTree(ctx.zones.tree).map(node => {
                    const devices = node.allDeviceIds.map(id => devicesById.get(id)).filter(Boolean) as typeof ctx.data.devices;
                    if (node.kind === 'room' && devices.length === 0) return null;
                    const active = ctx.activeSidebarView === 'room' && ctx.activeRoomId === node.id;
                    return (
                        <button key={node.id} className={`nav-sub-item ${active ? 'active' : ''}`} style={{ paddingLeft: 40 + node.depth * 14 }} onClick={() => ctx.onSelectRoom(node.id)}>
                            <ZoneIcon icon={node.icon} kind={node.kind} className="w-4 h-4" />
                            <span className="nav-sub-name">{node.name}</span>
                            {isZoneActive(summarizeDevices(devices)) && <span className="zone-active-dot" />}
                            <span className="nav-sub-meta">{devices.length}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    if (list === 'sensors') {
        const sensors = ctx.data.devices.filter(d => isSensorDevice(d) && inHome(d.household_id)).sort((a, b) => a.name.localeCompare(b.name));
        return (
            <div className="nav-sub">
                {sensors.map(sensor => {
                    const main = (sensor.properties ?? [])[0];
                    return (
                        <button key={sensor.id} className="nav-sub-item" onClick={() => ctx.onSelectDevice(sensor.id)}>
                            {React.cloneElement(getIconForDevice(sensor.type) as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4' })}
                            <span className="nav-sub-name">{sensor.name}</span>
                            {main && <span className="nav-sub-meta">{formatPropertyValue(main, t, lang)}</span>}
                        </button>
                    );
                })}
            </div>
        );
    }

    if (list === 'groups') {
        const groups = ctx.data.groups.filter(g => inHome(g.household_id));
        return (
            <div className="nav-sub">
                {groups.map(group => {
                    const active = ctx.activeSidebarView === 'group' && ctx.activeGroupId === group.id;
                    return (
                        <button key={group.id} className={`nav-sub-item ${active ? 'active' : ''}`} onClick={() => ctx.onSelectGroup(group.id)}>
                            <SquareStack className="w-4 h-4" />
                            <span className="nav-sub-name">{group.name}</span>
                            <span className="nav-sub-meta">{group.devices.length}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    const scenarios = ctx.data.scenarios.filter(s => s.is_active);
    const run = async (id: string) => {
        setRunning(id);
        try {
            await ctx.onExecuteScenario(id);
            setDone(id);
            setTimeout(() => setDone(current => (current === id ? null : current)), 1800);
        } catch { /* сообщение уже показано */ } finally { setRunning(null); }
    };
    return (
        <div className="nav-sub">
            {scenarios.map(scenario => (
                <button key={scenario.id} className="nav-sub-item" onClick={() => run(scenario.id)} disabled={running !== null} title={t('cards.run')}>
                    {running === scenario.id ? <Loader2 className="w-4 h-4 animate-spin" />
                        : done === scenario.id ? <CheckCircle2 className="w-4 h-4 nav-sub-done" /> : <Play className="w-4 h-4" />}
                    <span className="nav-sub-name">{scenario.name}</span>
                </button>
            ))}
        </div>
    );
};
