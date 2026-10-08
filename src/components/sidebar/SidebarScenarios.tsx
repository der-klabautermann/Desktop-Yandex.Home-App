import React from 'react';
import { ChevronDown, Star, Loader2 } from 'lucide-react';
import { YandexScenario } from '../../types/index';
import { getIconForScenario } from '../../constants';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';

interface SidebarScenariosProps {
    collapsed: boolean;
    onToggle: () => void;
    loadingItems: Record<string, boolean>;
    withLoading: (key: string, action: () => Promise<void>) => () => void;
    scenarios: YandexScenario[];
}

export const SidebarScenarios: React.FC<SidebarScenariosProps> = ({
    collapsed, onToggle, loadingItems, withLoading, scenarios,
}) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();

    if (scenarios.length === 0) return null;

    return (
        <>
            <div className="sidebar-section-title" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown className="w-3 h-3" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 150ms ease' }} />
                {t('dashboard.scenarios')}
            </div>
            {!collapsed && scenarios.map(s => (
                <div key={s.id} className={`sidebar-item ${s.unreachable ? 'is-unreachable' : ''}`} style={{ paddingRight: '8px' }}>
                    <span className="sidebar-item-icon">
                        {loadingItems[`scenario:${s.id}`]
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : React.cloneElement(getIconForScenario(s.icon, s.name) as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })
                        }
                    </span>
                    <span
                        style={{ flex: 1, fontSize: 13, cursor: 'pointer' }}
                        onClick={withLoading(`scenario:${s.id}`, () => ctx.onExecuteScenario(s.id))}
                    >
                        {s.name}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); ctx.onToggleScenarioFavorite(s.id); }}
                        style={{
                            position: 'static', background: 'none', border: 'none', cursor: 'pointer',
                            color: ctx.favoriteScenarioIds.includes(s.id) ? 'var(--fav-star)' : 'var(--muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 2, flexShrink: 0,
                        }}
                    >
                        <Star className="w-3.5 h-3.5" fill={ctx.favoriteScenarioIds.includes(s.id) ? 'currentColor' : 'none'} />
                    </button>
                </div>
            ))}
        </>
    );
};
