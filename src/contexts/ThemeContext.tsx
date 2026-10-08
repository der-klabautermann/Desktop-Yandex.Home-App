import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  ALL_TOKEN_NAMES,
  DEFAULT_SETTINGS,
  INTERVAL_OPTIONS,
  PALETTES,
  Palette,
  ThemeSettings,
  resolvePalette,
} from '../themes/palettes';
import { applyFont, fontById, migrateFont } from '../themes/fonts';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  /** Базовая тема текущей палитры (для компонентов, которым важно светло/темно). */
  theme: Theme;
  palette: Palette;
  settings: ThemeSettings;
  updateSettings: (patch: Partial<ThemeSettings>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'app_theme_settings';

const loadSettings = (): ThemeSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    const ids = PALETTES.map(p => p.id);
    return {
      mode: parsed.mode === 'cycle' || parsed.mode === 'fixed' ? parsed.mode : DEFAULT_SETTINGS.mode,
      fixed: parsed.fixed && ids.includes(parsed.fixed) ? parsed.fixed : DEFAULT_SETTINGS.fixed,
      intervalHours: INTERVAL_OPTIONS.includes(parsed.intervalHours ?? 0) ? parsed.intervalHours! : DEFAULT_SETTINGS.intervalHours,
      cycle: (() => {
        const valid = Array.isArray(parsed.cycle) ? parsed.cycle.filter(id => ids.includes(id)) : [];
        return valid.length >= 2 ? valid : DEFAULT_SETTINGS.cycle;
      })(),
      font: migrateFont(parsed as { font?: unknown; headingFont?: unknown }),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

/** Переносит палитру на <html>: базовая тема, класс dark для Tailwind и CSS-переменные. */
const applyPalette = (palette: Palette) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', palette.base);
  root.setAttribute('data-palette', palette.id);
  root.classList.toggle('dark', palette.base === 'dark');
  for (const name of ALL_TOKEN_NAMES) {
    root.style.removeProperty(name);
  }
  for (const [name, value] of Object.entries(palette.tokens)) {
    root.style.setProperty(name, value);
  }
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);
  const [palette, setPalette] = useState<Palette>(() => {
    const initialSettings = loadSettings();
    const initial = resolvePalette(initialSettings);
    applyPalette(initial);
    applyFont(fontById(initialSettings.font));
    return initial;
  });

  // Пересчитываем тему при изменении настроек и раз в минуту (смена по часам)
  useEffect(() => {
    const refresh = () => {
      const next = resolvePalette(settings);
      setPalette(prev => (prev.id === next.id ? prev : next));
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [settings]);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  useEffect(() => {
    applyFont(fontById(settings.font));
  }, [settings.font]);

  const updateSettings = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Настройки просто не сохранятся между запусками
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: palette.base, palette, settings, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
