import React from 'react';
import { Check, Moon, Sun, SunMoon } from 'lucide-react';
import { Segmented, SettingLine } from './Segmented';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { Daylight, INTERVAL_OPTIONS, PALETTES, PaletteId, SceneId, SeasonChoice, ThemeMode, nextChange, seasonFor } from '../../themes/palettes';

const DAYLIGHT: Daylight[] = ['auto', 'day', 'night'];
const SCENES: SceneId[] = ['none', 'cabin', 'village'];
const SEASONS: SeasonChoice[] = ['auto', 'spring', 'summer', 'autumn', 'winter'];

const MODES: ThemeMode[] = ['cycle', 'fixed'];

/** Цветовая тема: автосмена или одна тема, интервал, выбор тем. */
export const ThemeSettings: React.FC = () => {
    const { palette, settings, updateSettings } = useTheme();
    const { t } = useI18n();
    // Вне панели (без погоды) день и ночь считаем по часам
    const hour = new Date().getHours();
    const isNight = settings.daylight === 'night' || (settings.daylight === 'auto' && (hour >= 19 || hour < 7));
    const previewSeason = settings.season === 'auto' ? seasonFor(new Date()) : settings.season;
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
                <SettingLine label={t('theme.interval')}>
                    <Segmented
                        label={t('theme.interval')}
                        value={settings.intervalHours}
                        onChange={hours => updateSettings({ intervalHours: hours })}
                        options={INTERVAL_OPTIONS.map(hours => ({ value: hours, label: t('theme.hours', { hours }) }))}
                    />
                </SettingLine>
            )}

            <SettingLine label={t('daylight.title')}>
                <Segmented
                    label={t('daylight.title')}
                    value={settings.daylight}
                    onChange={option => updateSettings({ daylight: option })}
                    options={DAYLIGHT.map(option => ({
                        value: option,
                        label: t(`daylight.short.${option}`),
                        icon: option === 'auto' ? <SunMoon className="w-3.5 h-3.5" /> : option === 'day' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />,
                    }))}
                />
            </SettingLine>

            <div className="scene-picker" role="radiogroup" aria-label={t('scene.title')}>
                <span className="setting-line-label">{t('scene.title')}</span>
                <div className="scene-cards">
                    {SCENES.map(option => (
                        <button
                            key={option}
                            role="radio"
                            aria-checked={settings.scene === option}
                            className={`scene-card ${settings.scene === option ? 'is-active' : ''}`}
                            onClick={() => updateSettings({ scene: option })}
                        >
                            <span
                                className="scene-card-preview"
                                style={option === 'none'
                                    ? { background: `linear-gradient(135deg, ${palette.swatch[0]}, ${palette.swatch[1]})` }
                                    : { backgroundImage: `url(./scenes/${option}-${previewSeason}-${isNight ? 'night' : 'day'}.webp)` }}
                            />
                            <span className="scene-card-name">{t(`scene.${option}`)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {settings.scene !== 'none' && (
                <>
                    <SettingLine label={t('season.title')}>
                        <Segmented
                            label={t('season.title')}
                            value={settings.season}
                            onChange={option => updateSettings({ season: option })}
                            options={SEASONS.map(option => ({ value: option, label: t(`season.${option}`) }))}
                        />
                    </SettingLine>
                    <SettingLine label={t('scene.motion')}>
                        <button
                            role="switch"
                            aria-checked={settings.motion}
                            aria-label={t('scene.motion')}
                            className={`dd-switch ${settings.motion ? 'is-on' : ''}`}
                            onClick={() => updateSettings({ motion: !settings.motion })}
                        ><span /></button>
                    </SettingLine>
                </>
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
