import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Gauge, Home, LayoutGrid, Play, Server, Settings, SquareStack } from 'lucide-react';
import { SidebarSubList } from './sidebar/SidebarSubList';
import { YandexDevice } from '../types/index';
import { useDashboardContext } from '../contexts/DashboardContext';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarLandscape } from './sidebar/SidebarLandscape';
import { WeatherWidget } from './sidebar/WeatherWidget';
import { isSensorDevice } from '../constants';
import { useI18n } from '../i18n/I18nContext';
import type { PageView } from '../hooks/useNavigation';

type NavKey = 'rooms' | 'sensors' | 'groups' | 'scenarios';
const DEFAULT_ORDER: NavKey[] = ['rooms', 'sensors', 'groups', 'scenarios'];
const ORDER_KEY = 'sidebar:navOrder';
const OPEN_KEY = 'sidebar:navOpen';

const loadOpen = (): NavKey[] => {
    try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '["rooms"]'); } catch { return ['rooms']; }
};

const NAV: Record<NavKey, { icon: React.ElementType; label: string; views: string[] }> = {
    rooms: { icon: LayoutGrid, label: 'sidebar.rooms', views: ['rooms', 'room'] },
    sensors: { icon: Gauge, label: 'sidebar.sensors', views: ['sensors'] },
    groups: { icon: SquareStack, label: 'sidebar.groups', views: ['groups', 'group'] },
    scenarios: { icon: Play, label: 'sidebar.scenarios', views: ['scenarios'] },
};

/** Сохранённый порядок пунктов; новые пункты добавляются в конец. */
const loadOrder = (): NavKey[] => {
    try {
        const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') as NavKey[];
        const known = saved.filter(key => DEFAULT_ORDER.includes(key));
        return [...known, ...DEFAULT_ORDER.filter(key => !known.includes(key))];
    } catch {
        return DEFAULT_ORDER;
    }
};

interface SidebarProps {
    onOpenCameraStream?: (device: YandexDevice) => void;
}

/** Боковое меню: разделы как страницы, внизу пейзаж с погодой. Разделы можно перетаскивать. */
export const Sidebar: React.FC<SidebarProps> = () => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [order, setOrder] = useState<NavKey[]>(loadOrder);
    // Раскрытые списки под пунктами меню
    const [open, setOpen] = useState<NavKey[]>(loadOpen);
    const toggleOpen = (key: NavKey) => setOpen(prev => {
        const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
        try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* не сохранится */ }
        return next;
    });
    const [dragging, setDragging] = useState<NavKey | null>(null);
    const [dropAt, setDropAt] = useState<{ key: NavKey; after: boolean } | null>(null);
    const dropRef = useRef<{ key: NavKey; after: boolean } | null>(null);

    const sensorCount = useMemo(
        () => ctx.data.devices.filter(d => isSensorDevice(d) && (!ctx.activeHouseholdId || !d.household_id || d.household_id === ctx.activeHouseholdId)).length,
        [ctx.data.devices, ctx.activeHouseholdId],
    );

    const move = (from: NavKey, to: NavKey, after: boolean) => {
        if (from === to) return;
        setOrder(prev => {
            const without = prev.filter(key => key !== from);
            const index = without.indexOf(to) + (after ? 1 : 0);
            const next = [...without.slice(0, index), from, ...without.slice(index)];
            try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* не сохранится */ }
            return next;
        });
    };

    // Перетаскивание мышью: короткий клик открывает раздел, движение больше 6 px переставляет
    const startDrag = (key: NavKey, down: React.PointerEvent) => {
        if (down.button !== 0) return;
        // Ziehen nur am Menüpunkt selbst, nicht an der aufgeklappten Liste oder am Pfeil
        const target = down.target as HTMLElement;
        if (!target.closest('.nav-row') || target.closest('.nav-expand')) return;
        const startY = down.clientY;
        let active = false;
        const onMove = (e: PointerEvent) => {
            if (!active && Math.abs(e.clientY - startY) < 6) return;
            active = true;
            setDragging(key);
            const item = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-nav]');
            const target = item?.dataset.nav as NavKey | undefined;
            if (!item || !target) return;
            const box = item.getBoundingClientRect();
            dropRef.current = { key: target, after: e.clientY > box.top + box.height / 2 };
            setDropAt(dropRef.current);
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (active) {
                if (dropRef.current) move(key, dropRef.current.key, dropRef.current.after);
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

    const item = (key: string, Icon: React.ElementType, label: string, active: boolean, onClick: () => void, badge?: number) => (
        <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
            <span className="nav-item-icon"><Icon /></span>
            <span className="nav-item-label">{label}</span>
            {badge !== undefined && badge > 0 && <span className="nav-item-badge">{badge}</span>}
        </button>
    );

    return (
        <aside className="sidebar">
            <SidebarHeader />
            <nav className="sidebar-nav">
                {item('home', Home, t('sidebar.allDevices'), ctx.activeSidebarView === 'home', ctx.onSelectHome)}
                {order.map(key => {
                    const nav = NAV[key];
                    return (
                        <div
                            key={key}
                            data-nav={key}
                            className={`nav-slot ${dragging === key ? 'is-dragging' : ''} ${dropAt?.key === key && dragging !== key ? (dropAt.after ? 'drop-after' : 'drop-before') : ''}`}
                            onPointerDown={e => startDrag(key, e)}
                        >
                            <div className="nav-row">
                                {item(key, nav.icon, t(nav.label), nav.views.includes(ctx.activeSidebarView),
                                    () => ctx.onSelectPage(key as PageView), key === 'sensors' ? sensorCount : undefined)}
                                <button
                                    className={`nav-expand ${open.includes(key) ? 'is-open' : ''}`}
                                    onClick={() => toggleOpen(key)}
                                    aria-expanded={open.includes(key)}
                                    title={open.includes(key) ? t('sidebar.collapse') : t('sidebar.expand')}
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {open.includes(key) && <SidebarSubList list={key} />}
                        </div>
                    );
                })}
                <div className="nav-divider" />
                {item('settings', Settings, t('settings.title'), false, ctx.onOpenSettings)}
                {item('system', Server, t('sidebar.system'), false, ctx.onOpenServices)}
            </nav>
            <div className="sidebar-landscape">
                <SidebarLandscape />
                <WeatherWidget />
            </div>
        </aside>
    );
};
