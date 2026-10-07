import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { YandexDevice, YandexScenario } from '../types/index';
import { Home } from 'lucide-react';
import { useDashboardContext } from '../contexts/DashboardContext';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarFavorites } from './sidebar/SidebarFavorites';
import { SidebarSensors } from './sidebar/SidebarSensors';
import { SidebarRooms } from './sidebar/SidebarRooms';
import { SidebarGroups } from './sidebar/SidebarGroups';
import { SidebarScenarios } from './sidebar/SidebarScenarios';
import { useI18n } from '../i18n/I18nContext';

interface SidebarProps {
    onOpenCameraStream?: (device: YandexDevice) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCameraStream }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const getStorageKey = (baseKey: string): string => {
        if (!ctx.activeHouseholdId) return baseKey;
        return `${baseKey}:household:${ctx.activeHouseholdId}`;
    };

    const loadCollapsedSections = (): Record<string, boolean> => {
        try {
            const stored = localStorage.getItem(getStorageKey('sidebar:collapsedSections'));
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    };

    const saveCollapsedSections = (sections: Record<string, boolean>) => {
        try {
            localStorage.setItem(getStorageKey('sidebar:collapsedSections'), JSON.stringify(sections));
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        setCollapsedSections(loadCollapsedSections());
    }, [ctx.activeHouseholdId]);

    const toggleSection = (key: string) => {
        setCollapsedSections(prev => {
            const updated = { ...prev, [key]: !prev[key] };
            saveCollapsedSections(updated);
            return updated;
        });
    };

    const withLoading = (key: string, action: () => Promise<void>): (() => void) => {
        return () => {
            if (loadingItems[key]) return;
            setLoadingItems(prev => ({ ...prev, [key]: true }));
            action().finally(() => {
                setLoadingItems(prev => ({ ...prev, [key]: false }));
            });
        };
    };

    // Household-aware scenario filtering (same logic as Dashboard.tsx)
    const currentHousehold = useMemo(() => {
        if (!ctx.households || ctx.households.length === 0) return null;
        if (ctx.activeHouseholdId) {
            const found = ctx.households.find(h => h.id === ctx.activeHouseholdId);
            if (found) return found;
        }
        return ctx.households[0];
    }, [ctx.households, ctx.activeHouseholdId]);

    const deviceHouseholdMap = useMemo(() => {
        const map = new Map<string, string>();
        ctx.data.devices.forEach(device => {
            const anyDevice = device as any;
            let householdId: string | undefined =
                typeof anyDevice.household_id === 'string' ? anyDevice.household_id : undefined;
            if (!householdId && device.room) {
                const room = ctx.data.rooms.find(r => r.id === device.room);
                if (room) householdId = room.household_id;
            }
            if (householdId) map.set(device.id, householdId);
        });
        ctx.data.rooms.forEach(room => {
            room.devices.forEach(deviceId => {
                if (!map.has(deviceId)) map.set(deviceId, room.household_id);
            });
        });
        return map;
    }, [ctx.data.devices, ctx.data.rooms]);

    const isScenarioInCurrentHome = useCallback(
        (scenario: YandexScenario) => {
            if (!ctx.households || ctx.households.length <= 1) return true;
            if (!currentHousehold) return false;
            const steps = scenario.steps || [];
            const items: Array<{ id: string }> = [];
            for (const step of steps) {
                if (!step?.parameters?.items) continue;
                for (const it of step.parameters.items) items.push(it);
            }
            if (items.length === 0) return true;
            const targetHouseholdId = currentHousehold.id;
            for (const item of items) {
                const deviceId = typeof item.id === 'string' ? item.id : null;
                if (!deviceId) continue;
                if (deviceHouseholdMap.get(deviceId) === targetHouseholdId) return true;
            }
            return false;
        },
        [ctx.households, currentHousehold, deviceHouseholdMap]
    );

    const activeScenarios = ctx.data.scenarios.filter(
        s => s.is_active && isScenarioInCurrentHome(s)
    );

    return (
        <aside className="sidebar">
            <SidebarHeader />
            <nav className="sidebar-nav">
                <button
                    className={`sidebar-item ${ctx.activeSidebarView === 'home' ? 'active' : ''}`}
                    onClick={ctx.onSelectHome}
                >
                    <span className="sidebar-item-icon"><Home /></span>
                    {t('sidebar.allDevices')}
                </button>

                <SidebarFavorites
                    collapsed={!!collapsedSections['favorites']}
                    onToggle={() => toggleSection('favorites')}
                    loadingItems={loadingItems}
                    withLoading={withLoading}
                    onOpenCameraStream={onOpenCameraStream}
                />

                <SidebarSensors
                    collapsed={!!collapsedSections['sensors']}
                    onToggle={() => toggleSection('sensors')}
                />

                <SidebarRooms
                    collapsed={!!collapsedSections['rooms']}
                    onToggle={() => toggleSection('rooms')}
                />

                <SidebarGroups
                    collapsed={!!collapsedSections['groups']}
                    onToggle={() => toggleSection('groups')}
                />

                {activeScenarios.length > 0 && (
                    <SidebarScenarios
                        collapsed={!!collapsedSections['scenarios']}
                        onToggle={() => toggleSection('scenarios')}
                        loadingItems={loadingItems}
                        withLoading={withLoading}
                        scenarios={activeScenarios}
                    />
                )}
            </nav>
        </aside>
    );
};
