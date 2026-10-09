import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { YandexDevice, YandexScenario } from '../types/index';
import { Home } from 'lucide-react';
import { useDashboardContext } from '../contexts/DashboardContext';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarFavorites } from './sidebar/SidebarFavorites';
import { SidebarSensors } from './sidebar/SidebarSensors';
import { SidebarZones } from './sidebar/SidebarZones';
import { SidebarGroups } from './sidebar/SidebarGroups';
import { SidebarScenarios } from './sidebar/SidebarScenarios';
import { useI18n } from '../i18n/I18nContext';

type SectionKey = 'rooms' | 'favorites' | 'sensors' | 'groups' | 'scenarios';
const DEFAULT_ORDER: SectionKey[] = ['rooms', 'favorites', 'sensors', 'groups', 'scenarios'];
const ORDER_KEY = 'sidebar:sectionOrder';

/** Сохранённый порядок разделов; новые разделы добавляются в конец. */
const loadOrder = (): SectionKey[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') as SectionKey[];
        const known = saved.filter(key => DEFAULT_ORDER.includes(key));
        return [...known, ...DEFAULT_ORDER.filter(key => !known.includes(key))];
    } catch {
        return DEFAULT_ORDER;
    }
};

interface SidebarProps {
    onOpenCameraStream?: (device: YandexDevice) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCameraStream }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    // Разделы перетаскиваются за заголовок (мышью, без HTML-drag: надёжнее в Electron)
    const [order, setOrder] = useState<SectionKey[]>(loadOrder);
    const [dragging, setDragging] = useState<SectionKey | null>(null);
    const [dropAt, setDropAt] = useState<{ key: SectionKey; after: boolean } | null>(null);
    const dropRef = useRef<{ key: SectionKey; after: boolean } | null>(null);

    const moveSection = (from: SectionKey, to: SectionKey, after: boolean) => {
        if (from === to) return;
        setOrder(prev => {
            const without = prev.filter(key => key !== from);
            const index = without.indexOf(to) + (after ? 1 : 0);
            const next = [...without.slice(0, index), from, ...without.slice(index)];
            try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* не сохранится */ }
            return next;
        });
    };

    const startDrag = (key: SectionKey, down: React.PointerEvent) => {
        const title = (down.target as HTMLElement).closest('.sidebar-section-title');
        if (!title || (down.target as HTMLElement).closest('button') || down.button !== 0) return;
        const startY = down.clientY;
        let active = false;

        const onMove = (e: PointerEvent) => {
            if (!active && Math.abs(e.clientY - startY) < 6) return;
            active = true;
            setDragging(key);
            const section = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('.sidebar-section');
            const target = section?.dataset.section as SectionKey | undefined;
            if (!section || !target) return;
            const box = section.getBoundingClientRect();
            dropRef.current = { key: target, after: e.clientY > box.top + box.height / 2 };
            setDropAt(dropRef.current);
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (active) {
                if (dropRef.current) moveSection(key, dropRef.current.key, dropRef.current.after);
                // Отпускание после перетаскивания не должно сворачивать раздел
                const swallow = (e: MouseEvent) => e.stopPropagation();
                window.addEventListener('click', swallow, true);
                setTimeout(() => window.removeEventListener('click', swallow, true), 0);
            }
            dropRef.current = null;
            setDragging(null);
            setDropAt(null);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

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

    const renderSection = (key: SectionKey): React.ReactNode => {
        switch (key) {
            case 'favorites':
                return (
                    <SidebarFavorites
                        collapsed={!!collapsedSections['favorites']}
                        onToggle={() => toggleSection('favorites')}
                        loadingItems={loadingItems}
                        withLoading={withLoading}
                        onOpenCameraStream={onOpenCameraStream}
                    />
                );
            case 'sensors':
                return <SidebarSensors collapsed={!!collapsedSections['sensors']} onToggle={() => toggleSection('sensors')} />;
            case 'rooms':
                return <SidebarZones collapsed={!!collapsedSections['rooms']} onToggle={() => toggleSection('rooms')} />;
            case 'groups':
                return <SidebarGroups collapsed={!!collapsedSections['groups']} onToggle={() => toggleSection('groups')} />;
            case 'scenarios':
                return activeScenarios.length > 0 ? (
                    <SidebarScenarios
                        collapsed={!!collapsedSections['scenarios']}
                        onToggle={() => toggleSection('scenarios')}
                        loadingItems={loadingItems}
                        withLoading={withLoading}
                        scenarios={activeScenarios}
                    />
                ) : null;
        }
    };

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

                {order.map(key => (
                    <div
                        key={key}
                        data-section={key}
                        className={`sidebar-section ${dragging === key ? 'is-dragging' : ''} ${dropAt?.key === key && dragging !== key ? (dropAt.after ? 'drop-after' : 'drop-before') : ''}`}
                        onPointerDown={e => startDrag(key, e)}
                    >
                        {renderSection(key)}
                    </div>
                ))}
            </nav>
        </aside>
    );
};
