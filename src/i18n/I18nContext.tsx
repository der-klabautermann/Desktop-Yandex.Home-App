import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { de } from './de';
import { en } from './en';
import { ru } from './ru';
import { Dictionary, Language, Translate, detectLanguage, interpolate, pickPlural, resolveKey } from './core';

const DICTIONARIES: Record<Language, Dictionary> = { de, en, ru };
const STORAGE_KEY = 'app_language';

export type { Translate };
export type TranslatePlural = (key: string, count: number, vars?: Record<string, string | number>) => string;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Текст по ключу с подстановкой {name}. */
  t: Translate;
  /** Текст во множественном числе; {count} подставляется автоматически. */
  tp: TranslatePlural;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => detectLanguage(readStored(), navigator.language));

  useEffect(() => {
    document.documentElement.lang = lang;
    window.api?.setLanguage?.(lang);
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Выбор просто не сохранится между запусками
    }
    setLangState(next);
  }, []);

  const lookup = useCallback((key: string) => resolveKey(DICTIONARIES[lang], key) ?? resolveKey(en, key), [lang]);

  const t = useCallback<Translate>((key, vars) => {
    const value = lookup(key);
    if (value === undefined) return key;
    const text = typeof value === 'string' ? value : value.other;
    return interpolate(text, vars);
  }, [lookup]);

  const tp = useCallback<TranslatePlural>((key, count, vars) => {
    const value = lookup(key);
    if (value === undefined) return key;
    const text = typeof value === 'string' ? value : pickPlural(value, lang, count);
    return interpolate(text, { count, ...vars });
  }, [lookup, lang]);

  const value = useMemo(() => ({ lang, setLang, t, tp }), [lang, setLang, t, tp]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
};
