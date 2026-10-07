import React, { useEffect, useRef, useState } from 'react';
import { Palette as PaletteIcon, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { INTERVAL_OPTIONS, PALETTES, PaletteId, ThemeMode, nextChange } from '../themes/palettes';

const MODES: { id: ThemeMode; label: string; hint: string }[] = [
    { id: 'cycle', label: 'Автосмена', hint: 'Отмеченные темы сменяют друг друга. Нажмите на тему, чтобы добавить или убрать её.' },
    { id: 'fixed', label: 'Одна тема', hint: 'Нажмите на тему, чтобы закрепить её.' },
];

/** Кнопка в шапке и всплывающее окно выбора оформления. */
export const ThemePicker: React.FC = () => {
    const { palette, settings, updateSettings } = useTheme();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (event: MouseEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

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
        ? `Сейчас: «${palette.name}», следующая смена в ${change.getHours().toString().padStart(2, '0')}:00`
        : `Тема закреплена: «${palette.name}»`;

    return (
        <div className="theme-picker" ref={wrapperRef}>
            <button
                onClick={() => setOpen(v => !v)}
                className={`header-btn ${open ? 'active' : ''}`}
                title="Оформление"
            >
                <PaletteIcon className="w-4 h-4" />
            </button>

            {open && (
                <div className="theme-popover" role="dialog" aria-label="Оформление">
                    <div className="theme-popover-head">
                        <div className="theme-popover-title">Оформление</div>
                        <div className="theme-popover-status">{status}</div>
                    </div>

                    <div className="theme-modes" role="tablist">
                        {MODES.map(mode => (
                            <button
                                key={mode.id}
                                role="tab"
                                aria-selected={settings.mode === mode.id}
                                className={`theme-mode ${settings.mode === mode.id ? 'is-active' : ''}`}
                                onClick={() => updateSettings({ mode: mode.id })}
                                title={mode.hint}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                    <div className="theme-mode-hint">{MODES.find(m => m.id === settings.mode)?.hint}</div>

                    {settings.mode === 'cycle' && (
                        <div className="theme-interval">
                            <span>Интервал:</span>
                            {INTERVAL_OPTIONS.map(hours => (
                                <button
                                    key={hours}
                                    className={`theme-interval-chip ${settings.intervalHours === hours ? 'is-active' : ''}`}
                                    onClick={() => updateSettings({ intervalHours: hours })}
                                >
                                    {hours} ч
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="theme-grid">
                        {PALETTES.map(p => {
                            const isCurrent = p.id === palette.id;
                            const inCycle = settings.cycle.includes(p.id);
                            const dimmed = settings.mode === 'cycle' && !inCycle;
                            const caption = p.mood;
                            return (
                                <button
                                    key={p.id}
                                    className={`theme-tile ${isCurrent ? 'is-current' : ''} ${dimmed ? 'is-dimmed' : ''}`}
                                    onClick={() => onTileClick(p.id)}
                                    title={settings.mode === 'cycle'
                                        ? (inCycle ? 'Убрать из автосмены' : 'Добавить в автосмену')
                                        : 'Закрепить эту тему'}
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
                                    <span className="theme-tile-name">{p.name}</span>
                                    <span className="theme-tile-caption">{caption}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
