import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { INTERVAL_OPTIONS, PALETTES, PaletteId, ThemeMode, nextChange } from '../../themes/palettes';

const MODES: ThemeMode[] = ['cycle', 'fixed'];

/** Цветовая тема: автосмена или одна тема, интервал, выбор тем. */
export const ThemeSettings: React.FC = () => {
    const { palette, settings, updateSettings } = useTheme();
    const { t } = useI18n();
    const paletteName = (id: PaletteId) => t(`theme.palettes.${id}.name`);

    const toggleCycleMember = (id: PaletteId) => {
        const has = settings.cycle.includes(id);
        // В автосмене должны остаться хотя бы две темы, иначе смены не будет
        if (has && settings.cycle.length <= 2) return;
        updateSettings({ cycle: has ? settings.cycle.filter(x => x !== id) : [...settings.cycle, id] });
    };

    const onTileClick = (id: PaletteId) => {
        if (settings.mode === 'cycle') toggleCycleMember(id);
        else updateSettings({ mode: 'fixed', fixed: id });
    };

    const change = nextChange(settings);
    const status = change
        ? t('theme.statusCycle', { name: paletteName(palette.id), time: `${change.getHours().toString().padStart(2, '0')}:00` })
        : t('theme.statusFixed', { name: paletteName(palette.id) });

    return (
        <div className="theme-settings">
            <div className="theme-popover-status">{status}</div>

            <div className="theme-modes" role="tablist">
                {MODES.map(mode => (
                    <button
                        key={mode}
                        role="tab"
                        aria-selected={settings.mode === mode}
                        className={`theme-mode ${settings.mode === mode ? 'is-active' : ''}`}
                        onClick={() => updateSettings({ mode })}
                    >
                        {t(`theme.modes.${mode}.label`)}
                    </button>
                ))}
            </div>
            <div className="theme-mode-hint">{t(`theme.modes.${settings.mode}.hint`)}</div>

            {settings.mode === 'cycle' && (
                <div className="theme-interval">
                    <span>{t('theme.interval')}</span>
                    {INTERVAL_OPTIONS.map(hours => (
                        <button
                            key={hours}
                            className={`theme-interval-chip ${settings.intervalHours === hours ? 'is-active' : ''}`}
                            onClick={() => updateSettings({ intervalHours: hours })}
                        >
                            {t('theme.hours', { hours })}
                        </button>
                    ))}
                </div>
            )}

            <div className="theme-grid settings-theme-grid">
                {PALETTES.map(p => {
                    const isCurrent = p.id === palette.id;
                    const inCycle = settings.cycle.includes(p.id);
                    const dimmed = settings.mode === 'cycle' && !inCycle;
                    return (
                        <button
                            key={p.id}
                            className={`theme-tile ${isCurrent ? 'is-current' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                            onClick={() => onTileClick(p.id)}
                            title={settings.mode === 'cycle'
                                ? (inCycle ? t('theme.removeFromCycle') : t('theme.addToCycle'))
                                : t('theme.pin')}
                        >
                            <span className="theme-swatch" style={{ background: p.swatch[0] }}>
                                <span className="theme-swatch-glow" style={{ background: p.swatch[1] }} />
                                <span className="theme-swatch-glow is-second" style={{ background: p.swatch[2] }} />
                                <span className="theme-swatch-card" style={{ background: p.swatch[3] }}>
                                    <span style={{ background: p.swatch[1] }} />
                                </span>
                                {settings.mode === 'cycle' && inCycle && (
                                    <span className="theme-swatch-check"><Check className="w-3 h-3" /></span>
                                )}
                            </span>
                            <span className="theme-tile-name">{paletteName(p.id)}</span>
                            <span className="theme-tile-caption">{t(`theme.palettes.${p.id}.mood`)}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
