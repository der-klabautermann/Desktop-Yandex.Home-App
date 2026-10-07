import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';

export const SidebarHeader: React.FC = () => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [houseDropdownOpen, setHouseDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentHousehold = React.useMemo(() => {
        if (!ctx.households || ctx.households.length === 0) return null;
        if (ctx.activeHouseholdId) {
            const found = ctx.households.find(h => h.id === ctx.activeHouseholdId);
            if (found) return found;
        }
        return ctx.households[0];
    }, [ctx.households, ctx.activeHouseholdId]);

    const homeName = currentHousehold?.name || t('dashboard.defaultHomeName');
    const hasMultipleHomes = (ctx.households?.length || 0) > 1;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setHouseDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="sidebar-header">
            <div className="house-selector" onClick={() => hasMultipleHomes && setHouseDropdownOpen(!houseDropdownOpen)} ref={dropdownRef}>
                <div className="house-selector-name">{homeName}</div>
                {hasMultipleHomes && (
                    <ChevronDown className="w-3.5 h-3.5 text-muted" style={{ transform: houseDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />
                )}
                {houseDropdownOpen && (
                    <div className="house-selector-dropdown">
                        {ctx.households.map(h => (
                            <div
                                key={h.id}
                                className={`house-option ${h.id === ctx.activeHouseholdId ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (h.id !== ctx.activeHouseholdId) {
                                        ctx.onSwitchHousehold(h.id);
                                    }
                                    setHouseDropdownOpen(false);
                                }}
                            >
                                {h.name}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
