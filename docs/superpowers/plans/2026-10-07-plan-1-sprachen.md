# Plan 1: Drei Sprachen (DE / EN / RU) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die gesamte Oberfläche (Renderer, Tray-Menü, Systembenachrichtigungen, Fehlermeldungen) ist auf Deutsch, Englisch und Russisch verfügbar und über ein Sprachmenü umschaltbar.

**Architecture:** Eigene, kleine i18n-Schicht ohne Bibliothek: Sprachdateien als TypeScript-Objekte (`ru.ts` ist die Referenz, `en.ts` und `de.ts` müssen dieselben Schlüssel haben), ein React-Context mit `t()` (Interpolation `{name}`) und `tp()` (Mehrzahl über `Intl.PluralRules`). Der Hauptprozess bekommt die gewählte Sprache per IPC und hat ein eigenes kleines Wörterbuch für Tray und Benachrichtigungen. Fehler aus dem Hauptprozess werden zu stabilen Codes, die der Renderer übersetzt.

**Tech Stack:** React 19, TypeScript, Electron 39, Vite 6, vitest (neu).

**Spezifikation:** `docs/superpowers/specs/2026-10-07-smart-home-zentrale-design.md`, Abschnitt „Sprachen".

---

## Dateistruktur

| Datei | Zweck |
|---|---|
| `src/i18n/ru.ts` | Russische Texte, Referenz für die Schlüssel |
| `src/i18n/en.ts` | Englische Texte, gleiche Schlüssel |
| `src/i18n/de.ts` | Deutsche Texte, gleiche Schlüssel |
| `src/i18n/core.ts` | Reine Funktionen: Schlüssel auflösen, Interpolation, Mehrzahl, Sprache erkennen (ohne React, testbar) |
| `src/i18n/I18nContext.tsx` | React-Context, `useI18n()`, speichert die Wahl, meldet sie an den Hauptprozess |
| `src/i18n/i18n.test.ts` | Tests für `core.ts` und Schlüsselgleichheit |
| `src/components/LanguagePicker.tsx` | Sprachmenü neben dem Paletten-Knopf |
| `electron/i18n.js` | Wörterbuch des Hauptprozesses (Tray, Benachrichtigungen) |
| Änderungen | alle Dateien mit sichtbaren russischen Texten, siehe Tasks 6 bis 12 |

## Konventionen für die Übersetzung

- Schlüssel sind englisch, gruppiert nach Bereich: `common.*`, `auth.*`, `dashboard.*`, `sidebar.*`, `cards.*`, `modals.<name>.*`, `camera.*`, `theme.*`, `errors.*`, `units.*`.
- Platzhalter in geschweiften Klammern: `'{count} устройств в доме'` wird zu `tp('dashboard.devicesInHome', count)`.
- Anrede: Russisch „Вы", Deutsch „Sie", Englisch neutral.
- Nicht übersetzen: Namen aus Diensten (Geräte, Räume, Szenarien, Häuser), Log-Ausgaben (`console.*`, `debugLog`), Code-Kommentare.
- Mustererkennung auf russische Wörter, die Yandex-Daten prüft (z. B. `/приват/` in `src/constants/camera.ts`), bleibt unverändert, sie ist keine Anzeige.

---

### Task 1: vitest einrichten

**Files:**
- Modify: `package.json`

- [ ] **Step 1: vitest installieren**

Run: `npm install --save-dev vitest@^3`
Expected: `added ... packages`, keine Fehler.

- [ ] **Step 2: Test-Skript ergänzen**

In `package.json` unter `"scripts"` ergänzen:

```json
"test": "vitest run --root ."
```

- [ ] **Step 3: Bestehende Tests laufen lassen**

Run: `npm test`
Expected: Die vorhandenen Tests `src/constants/deviceTypes.test.ts` und `src/constants/formatting.test.ts` laufen. Schlagen einzelne fehl, Ausgabe notieren und unverändert lassen (nicht Teil dieses Plans), aber vitest selbst muss starten.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "vitest als Testwerkzeug einrichten"
```

---

### Task 2: i18n-Kern (reine Funktionen)

**Files:**
- Create: `src/i18n/core.ts`
- Create: `src/i18n/i18n.test.ts`

- [ ] **Step 1: Failing test schreiben**

`src/i18n/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectLanguage, interpolate, pluralCategory, resolveKey, type Dictionary } from './core';

const dict: Dictionary = {
  dashboard: {
    title: 'Дом',
    greeting: 'Привет, {name}!',
    devices: { one: '{count} устройство', few: '{count} устройства', many: '{count} устройств', other: '{count} устройства' },
  },
};

describe('resolveKey', () => {
  it('findet verschachtelte Schlüssel', () => {
    expect(resolveKey(dict, 'dashboard.title')).toBe('Дом');
  });
  it('liefert undefined für fehlende Schlüssel', () => {
    expect(resolveKey(dict, 'dashboard.missing')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('ersetzt Platzhalter', () => {
    expect(interpolate('Привет, {name}!', { name: 'Макс' })).toBe('Привет, Макс!');
  });
  it('lässt unbekannte Platzhalter stehen', () => {
    expect(interpolate('{a} und {b}', { a: 1 })).toBe('1 und {b}');
  });
});

describe('pluralCategory', () => {
  it('russische Mehrzahl', () => {
    expect(pluralCategory('ru', 1)).toBe('one');
    expect(pluralCategory('ru', 3)).toBe('few');
    expect(pluralCategory('ru', 8)).toBe('many');
    expect(pluralCategory('ru', 21)).toBe('one');
  });
  it('deutsche Mehrzahl', () => {
    expect(pluralCategory('de', 1)).toBe('one');
    expect(pluralCategory('de', 8)).toBe('other');
  });
});

describe('detectLanguage', () => {
  it('nimmt gespeicherte Wahl zuerst', () => {
    expect(detectLanguage('de', 'ru-RU')).toBe('de');
  });
  it('fällt auf Systemsprache zurück', () => {
    expect(detectLanguage(null, 'ru-RU')).toBe('ru');
    expect(detectLanguage(null, 'de-AT')).toBe('de');
  });
  it('fällt auf Englisch zurück', () => {
    expect(detectLanguage(null, 'fr-FR')).toBe('en');
    expect(detectLanguage('xx', undefined)).toBe('en');
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `npx vitest run src/i18n/i18n.test.ts`
Expected: FAIL, `Cannot find module './core'`.

- [ ] **Step 3: `src/i18n/core.ts` schreiben**

```ts
// Ядро локализации без React: поиск ключей, подстановка, множественное число.

export type Language = 'de' | 'en' | 'ru';
export const LANGUAGES: Language[] = ['de', 'en', 'ru'];

export type PluralForms = { one: string; few?: string; many?: string; other: string };
export interface Dictionary {
  [key: string]: string | PluralForms | Dictionary;
}

const isPluralForms = (value: unknown): value is PluralForms =>
  typeof value === 'object' && value !== null && 'one' in value && 'other' in value;

export const resolveKey = (dict: Dictionary, key: string): string | PluralForms | undefined => {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === 'string' || isPluralForms(node)) return node;
  return undefined;
};

export const interpolate = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;

export const pluralCategory = (lang: Language, count: number): keyof PluralForms => {
  const category = new Intl.PluralRules(lang).select(count);
  if (category === 'one' || category === 'few' || category === 'many') return category;
  return 'other';
};

export const pickPlural = (forms: PluralForms, lang: Language, count: number): string =>
  forms[pluralCategory(lang, count)] ?? forms.other;

export const detectLanguage = (stored: string | null, systemLocale: string | undefined): Language => {
  if (stored && (LANGUAGES as string[]).includes(stored)) return stored as Language;
  const prefix = (systemLocale ?? '').slice(0, 2).toLowerCase();
  if ((LANGUAGES as string[]).includes(prefix)) return prefix as Language;
  return 'en';
};

/** Собирает все листовые ключи словаря, например 'dashboard.title'. */
export const collectKeys = (dict: Dictionary, prefix = ''): string[] =>
  Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralForms(value)) return [path];
    return collectKeys(value, path);
  });
```

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `npx vitest run src/i18n/i18n.test.ts`
Expected: PASS, 9 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/core.ts src/i18n/i18n.test.ts
git commit -m "i18n-Kern: Schlüssel, Platzhalter, Mehrzahl, Spracherkennung"
```

---

### Task 3: Sprachdateien und Schlüsselgleichheits-Test

**Files:**
- Create: `src/i18n/ru.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`
- Modify: `src/i18n/i18n.test.ts`

- [ ] **Step 1: Failing test für Schlüsselgleichheit ergänzen**

An `src/i18n/i18n.test.ts` anhängen:

```ts
import { ru } from './ru';
import { en } from './en';
import { de } from './de';
import { collectKeys } from './core';

describe('Sprachdateien', () => {
  const reference = collectKeys(ru).sort();
  it.each([['en', en], ['de', de]] as const)('%s hat dieselben Schlüssel wie ru', (_name, dict) => {
    expect(collectKeys(dict).sort()).toEqual(reference);
  });
  it('keine leeren Texte', () => {
    for (const dict of [ru, en, de]) {
      for (const key of collectKeys(dict)) {
        const value = key.split('.').reduce<any>((node, part) => node[part], dict);
        const texts = typeof value === 'string' ? [value] : Object.values(value as object);
        for (const text of texts) expect(String(text).trim()).not.toBe('');
      }
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `npx vitest run src/i18n/i18n.test.ts`
Expected: FAIL, `Cannot find module './ru'`.

- [ ] **Step 3: Startwörterbücher anlegen**

Mit den Bereichen, die Task 4 bis 5 sofort brauchen. Weitere Schlüssel kommen in Tasks 6 bis 12 dazu, immer in allen drei Dateien gleichzeitig.

`src/i18n/ru.ts`:

```ts
import type { Dictionary } from './core';

export const ru = {
  common: {
    yes: 'Да',
    no: 'Нет',
    close: 'Закрыть',
    cancel: 'Отмена',
    save: 'Сохранить',
    retry: 'Повторить',
  },
  language: {
    title: 'Язык',
    de: 'Deutsch',
    en: 'English',
    ru: 'Русский',
  },
} satisfies Dictionary;
```

`src/i18n/en.ts`:

```ts
import type { Dictionary } from './core';

export const en = {
  common: {
    yes: 'Yes',
    no: 'No',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    retry: 'Retry',
  },
  language: {
    title: 'Language',
    de: 'Deutsch',
    en: 'English',
    ru: 'Русский',
  },
} satisfies Dictionary;
```

`src/i18n/de.ts`:

```ts
import type { Dictionary } from './core';

export const de = {
  common: {
    yes: 'Ja',
    no: 'Nein',
    close: 'Schließen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    retry: 'Erneut versuchen',
  },
  language: {
    title: 'Sprache',
    de: 'Deutsch',
    en: 'English',
    ru: 'Русский',
  },
} satisfies Dictionary;
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/i18n/i18n.test.ts`
Expected: PASS, 12 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "Sprachdateien DE/EN/RU mit Schlüsselgleichheits-Test"
```

---

### Task 4: React-Context und Hauptprozess-Anbindung

**Files:**
- Create: `src/i18n/I18nContext.tsx`
- Modify: `src/index.tsx` (Provider einhängen)
- Modify: `electron/preload.cjs` (neue Methode `setLanguage`)
- Modify: `src/types/electron-api.d.ts` (Typ ergänzen)

- [ ] **Step 1: `src/i18n/I18nContext.tsx` schreiben**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { de } from './de';
import { en } from './en';
import { ru } from './ru';
import { Dictionary, Language, detectLanguage, interpolate, pickPlural, resolveKey } from './core';

const DICTIONARIES: Record<Language, Dictionary> = { de, en, ru };
const STORAGE_KEY = 'app_language';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Текст по ключу с подстановкой {name}. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Текст во множественном числе; {count} подставляется автоматически. */
  tp: (key: string, count: number, vars?: Record<string, string | number>) => string;
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

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const value = lookup(key);
    if (value === undefined) return key;
    const text = typeof value === 'string' ? value : value.other;
    return interpolate(text, vars);
  }, [lookup]);

  const tp = useCallback((key: string, count: number, vars?: Record<string, string | number>) => {
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
```

- [ ] **Step 2: Provider in `src/index.tsx` einhängen**

`StrictMode` ist in dieser Datei auskommentiert und bleibt es. Den Render-Aufruf ersetzen:

```tsx
import { I18nProvider } from './i18n/I18nContext';
// ...
root.render(
  // <React.StrictMode>
  <I18nProvider>
    <App />
  </I18nProvider>
  // </React.StrictMode>
);
```

- [ ] **Step 3: Preload und Typ ergänzen**

In `electron/preload.cjs` im `exposeInMainWorld('api', { ... })`-Objekt ergänzen:

```js
    setLanguage: (lang) => ipcRenderer.send('app:set-language', lang),
```

In `src/types/electron-api.d.ts` im Interface `IYandexApi` ergänzen:

```ts
    setLanguage?: (lang: 'de' | 'en' | 'ru') => void;
```

- [ ] **Step 4: Bauen**

Run: `npm run build`
Expected: `✓ built in ...`, keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/I18nContext.tsx src/index.tsx electron/preload.cjs src/types/electron-api.d.ts
git commit -m "i18n-Context mit t()/tp(), Sprache an den Hauptprozess melden"
```

---

### Task 5: Sprachmenü

**Files:**
- Create: `src/components/LanguagePicker.tsx`
- Modify: `src/components/Dashboard.tsx` (neben `<ThemePicker />` einsetzen)
- Modify: `src/index.css` (Stil, angelehnt an `.theme-popover`)

- [ ] **Step 1: Komponente schreiben**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LANGUAGES } from '../i18n/core';

/** Кнопка в шапке со списком языков. */
export const LanguagePicker: React.FC = () => {
  const { lang, setLang, t } = useI18n();
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

  return (
    <div className="theme-picker" ref={wrapperRef}>
      <button onClick={() => setOpen(v => !v)} className={`header-btn ${open ? 'active' : ''}`} title={t('language.title')}>
        <Languages className="w-4 h-4" />
      </button>
      {open && (
        <div className="language-popover" role="menu" aria-label={t('language.title')}>
          {LANGUAGES.map(code => (
            <button
              key={code}
              role="menuitemradio"
              aria-checked={lang === code}
              className={`language-option ${lang === code ? 'is-active' : ''}`}
              onClick={() => { setLang(code); setOpen(false); }}
            >
              <span className="language-code">{code.toUpperCase()}</span>
              {t(`language.${code}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: In `Dashboard.tsx` einsetzen**

Import ergänzen: `import { LanguagePicker } from './LanguagePicker';`. Direkt nach `<ThemePicker />` einfügen: `<LanguagePicker />`.

- [ ] **Step 3: Stil an `src/index.css` anhängen**

```css
/* Language picker */
.language-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: -6px;
  z-index: 200;
  min-width: 180px;
  padding: 6px;
  border-radius: 16px;
  background: color-mix(in oklab, var(--surface) 82%, transparent);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
  border: 1px solid var(--glass-line-strong);
  box-shadow: 0 24px 60px -18px rgba(0, 0, 0, 0.45);
  animation: popIn 220ms var(--ease-standard);
  transform-origin: top right;
  -webkit-app-region: no-drag;
}

.language-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.language-option:hover { background: color-mix(in oklab, var(--fg) 6%, transparent); }

.language-option.is-active {
  background: color-mix(in oklab, var(--accent) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 45%, transparent);
}

.language-code {
  width: 26px;
  font-family: var(--font-display);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--accent);
}
```

- [ ] **Step 4: Bauen**

Run: `npm run build`
Expected: `✓ built in ...`.

- [ ] **Step 5: Commit**

```bash
git add src/components/LanguagePicker.tsx src/components/Dashboard.tsx src/index.css
git commit -m "Sprachmenü in der Kopfzeile"
```

---

### Tasks 6 bis 12: Texte herauslösen

Jeder dieser Tasks folgt demselben Ablauf, nur die Dateien unterscheiden sich. Er wird für jede Dateigruppe vollständig durchlaufen.

**Ablauf je Task:**

- [ ] **Step 1:** Jede Datei der Gruppe lesen und alle sichtbaren russischen Texte auflisten (JSX-Text, `title=`, `placeholder=`, `aria-label=`, Texte in Meldungen, Rückgabewerte von Formatierungsfunktionen). Nicht dazu gehören Kommentare, `console.*`, `debugLog`/`debugWarn`/`debugError` und Mustererkennung auf Yandex-Daten.
- [ ] **Step 2:** Für jeden Text einen Schlüssel nach den Konventionen oben anlegen, gleichzeitig in `ru.ts` (Originaltext), `en.ts` und `de.ts` (Übersetzung). Zahlen mit Mehrzahl als `PluralForms` (`one/few/many/other` für ru, `one/other` für en und de).
- [ ] **Step 3:** In jeder Komponente `const { t, tp } = useI18n();` einführen (Import `import { useI18n } from '../i18n/I18nContext';`, Pfad je nach Ordnertiefe) und die Texte durch `t('…')` bzw. `tp('…', count)` ersetzen. Für Nicht-Komponenten (Hooks, Hilfsfunktionen) `t` als Parameter durchreichen statt den Hook aufzurufen, wenn die Funktion außerhalb von React läuft.
- [ ] **Step 4:** Prüfen, dass in der Gruppe keine sichtbaren russischen Texte übrig sind:

  Run (Dateiliste der Gruppe einsetzen):
  ```bash
  for f in <DATEIEN>; do grep -nE "[а-яА-ЯёЁ]" "$f" | grep -vE "^\s*[0-9]+:\s*(//|\*|/\*)" | grep -vE "console\.|debug(Log|Warn|Error)"; done
  ```
  Expected: keine Ausgabe, außer bewusst ausgenommene Mustererkennung (in der Commit-Nachricht nennen).
- [ ] **Step 5:** `npx vitest run src/i18n` (Schlüsselgleichheit) und `npm run build`.
  Expected: PASS und `✓ built`.
- [ ] **Step 6:** Commit mit der Liste der Dateien.

**Dateigruppen:**

| Task | Dateien | Bereich |
|---|---|---|
| 6 | `src/components/Dashboard.tsx`, `src/components/DashboardHomeView.tsx`, `src/components/DashboardRoomView.tsx`, `src/components/DashboardGroupView.tsx`, `src/components/NotificationToast.tsx` | `dashboard.*` (inkl. Mehrzahl „{count} устройств в доме", „{count} устройств, {on} включено"; `DEFAULT_HOME_NAME`) |
| 7 | `src/components/Sidebar.tsx`, `src/components/sidebar/*.tsx` | `sidebar.*` |
| 8 | `src/components/cards/*.tsx`, `src/constants/icons.tsx`, `src/constants/formatting.ts` | `cards.*`, `units.*` (`formatting.ts` bekommt `t` als Parameter; Tests in `formatting.test.ts` mit einem Stub-`t` anpassen, der die russischen Texte liefert) |
| 9 | `src/components/modals/BrightnessSettingsModal.tsx`, `GroupLightSettingsModal.tsx` | `modals.light.*` (gemeinsame Texte beider Fenster nur einmal) |
| 10 | `src/components/modals/ThermostatSettingsModal.tsx`, `GroupThermostatSettingsModal.tsx`, `FanSettingsModal.tsx`, `GroupFanSettingsModal.tsx`, `SensorSettingsModal.tsx` | `modals.climate.*`, `modals.fan.*`, `modals.sensor.*` |
| 11 | `src/components/modals/CameraStreamModal.tsx`, `QrAuthModal.tsx`, `InfoModal.tsx`, `UpdateNotificationModal.tsx`, `src/services/yandexGoloomWebRtc.ts`, `src/hooks/useCameraAuth.ts`, `src/hooks/useUpdateNotification.ts` | `camera.*`, `modals.info.*`, `modals.update.*` |
| 12 | `src/App.tsx`, `src/components/TokenInput.tsx`, `src/components/ThemePicker.tsx`, `src/themes/palettes.ts`, `src/hooks/useDeviceActions.ts`, `src/hooks/useYandexData.ts`, `src/hooks/useAutostart.ts`, `src/hooks/useHousehold.ts`, `src/hooks/useAuth.ts` | `auth.*`, `theme.*` (Theme-Namen und Beschreibungen: `palettes.ts` speichert statt `name`/`mood` die Schlüssel `nameKey`/`moodKey`, `ThemePicker` übersetzt; Theme-Namen DE: „Meine Welle", „Alice", „Musik", „Zuhause", „Stadt bei Nacht", „Plus", „Türkis"; EN: „My Wave", „Alice", „Music", „Home", „Night City", „Plus", „Turquoise") |

---

### Task 13: Fehlermeldungen aus dem Hauptprozess als Codes

**Files:**
- Modify: `electron/yandex-api.js`
- Modify: `src/utils/errors.ts`
- Create: `src/utils/errors.test.ts`

- [ ] **Step 1: Failing test schreiben**

`src/utils/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cleanErrorMessage } from './errors';

const t = (key: string) => `[${key}]`;

describe('cleanErrorMessage', () => {
  it('übersetzt bekannte Codes', () => {
    const err = new Error("Error invoking remote method 'yandex-api:fetchUserInfo': Error: ERR_AUTH");
    expect(cleanErrorMessage(err, t)).toBe('[errors.auth]');
  });
  it('übersetzt Netzwerkfehler', () => {
    expect(cleanErrorMessage(new Error('ERR_NETWORK'), t)).toBe('[errors.network]');
  });
  it('HTTP-Status wird allgemeiner Fehler', () => {
    expect(cleanErrorMessage(new Error('ERR_HTTP 500'), t)).toBe('[errors.request]');
  });
  it('unbekannter Typ', () => {
    expect(cleanErrorMessage('kaputt', t)).toBe('[errors.unknown]');
  });
  it('fremder Text bleibt erhalten', () => {
    expect(cleanErrorMessage(new Error('Something specific'), t)).toBe('Something specific');
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `npx vitest run src/utils/errors.test.ts`
Expected: FAIL (Signatur hat noch keinen `t`-Parameter, Codes unbekannt).

- [ ] **Step 3: `src/utils/errors.ts` ersetzen**

```ts
/**
 * Превращает ошибку из главного процесса в понятный текст на выбранном языке.
 * Главный процесс сообщает стабильные коды (ERR_AUTH, ERR_NETWORK, ERR_HTTP <status>).
 */
type Translate = (key: string) => string;

const CODE_KEYS: Record<string, string> = {
  ERR_AUTH: 'errors.auth',
  ERR_NETWORK: 'errors.network',
  X_TOKEN_REQUIRED: 'errors.xTokenRequired',
};

export function cleanErrorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof Error)) return t('errors.unknown');

  const message = error.message.replace(/^Error invoking remote method\s+'[^']+':\s*Error:\s*/i, '').trim();

  if (message in CODE_KEYS) return t(CODE_KEYS[message]);
  if (/^ERR_HTTP\b/.test(message) || /^\d{3}\s/.test(message) || /error_code/i.test(message)) {
    return t('errors.request');
  }
  return message;
}
```

Schlüssel in allen drei Sprachdateien ergänzen:

```ts
// ru.ts
errors: {
  unknown: 'Произошла неизвестная ошибка',
  auth: 'Ошибка авторизации. Проверьте ваш токен.',
  network: 'Ошибка сети. Проверьте подключение.',
  request: 'Произошла ошибка при выполнении запроса. Попробуйте позже.',
  xTokenRequired: 'Нужно войти через QR-код, чтобы смотреть камеры.',
},
// en.ts
errors: {
  unknown: 'An unknown error occurred',
  auth: 'Authorization failed. Please check your token.',
  network: 'Network error. Please check your connection.',
  request: 'The request failed. Please try again later.',
  xTokenRequired: 'Sign in with the QR code to view cameras.',
},
// de.ts
errors: {
  unknown: 'Ein unbekannter Fehler ist aufgetreten',
  auth: 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihren Token.',
  network: 'Netzwerkfehler. Bitte prüfen Sie die Verbindung.',
  request: 'Die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es später erneut.',
  xTokenRequired: 'Melden Sie sich per QR-Code an, um Kameras zu sehen.',
},
```

- [ ] **Step 4: Hauptprozess auf Codes umstellen**

In `electron/yandex-api.js`:
- `throw new Error('Ошибка сети. Проверьте подключение.')` wird `throw new Error('ERR_NETWORK')`.
- jedes `throw new Error('Ошибка авторизации. Проверьте ваш токен.')` wird `throw new Error('ERR_AUTH')`.
- jedes `` throw new Error(`Ошибка загрузки данных: ${response.status} ${response.statusText}`) `` und gleichartige Meldungen mit Status werden `` throw new Error(`ERR_HTTP ${response.status}`) ``.
- In `withRetry` die Prüfung `error.message?.includes('авторизац')` ersetzen durch `error.message === 'ERR_AUTH'`, und in `isNetworkError` `error.message?.includes('Ошибка сети')` ersetzen durch `error.message === 'ERR_NETWORK'`.
- In `src/App.tsx` die Prüfung auf `'401'`/`'403'` in `handleLoadData` ergänzen um `err.message.includes('ERR_AUTH')`, damit ein ungültiger Token weiterhin gelöscht wird.
- Alle Aufrufer von `cleanErrorMessage(err)` bekommen `t` als zweites Argument (`grep -rn "cleanErrorMessage(" src`).

- [ ] **Step 5: Tests und Build**

Run: `npx vitest run && npm run build`
Expected: alle PASS, `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add electron/yandex-api.js src/utils src/App.tsx src/i18n
git commit -m "Fehler aus dem Hauptprozess als Codes, Übersetzung im Renderer"
```

---

### Task 14: Tray-Menü und Benachrichtigungen übersetzen

**Files:**
- Create: `electron/i18n.js`
- Modify: `electron/main.js`

- [ ] **Step 1: `electron/i18n.js` schreiben**

```js
// Тексты главного процесса (трей, уведомления) на трёх языках.

const STRINGS = {
    ru: {
        trayTooltip: 'Управление умным домом',
        openApp: 'Открыть приложение',
        quit: 'Выход',
        cameraNoVideo: '{name}: нет видео',
        retry: 'Повторить',
        close: 'Закрыть',
        retryAttempt: 'Попытка повторного подключения {attempt} из {max}...',
    },
    en: {
        trayTooltip: 'Smart home control',
        openApp: 'Open app',
        quit: 'Quit',
        cameraNoVideo: '{name}: no video',
        retry: 'Retry',
        close: 'Close',
        retryAttempt: 'Reconnecting, attempt {attempt} of {max}...',
    },
    de: {
        trayTooltip: 'Smart-Home-Steuerung',
        openApp: 'App öffnen',
        quit: 'Beenden',
        cameraNoVideo: '{name}: kein Video',
        retry: 'Erneut versuchen',
        close: 'Schließen',
        retryAttempt: 'Verbindung wird wiederhergestellt, Versuch {attempt} von {max} …',
    },
};

let current = 'ru';

export const setMainLanguage = (lang) => {
    if (STRINGS[lang]) current = lang;
};

export const tm = (key, vars = {}) => {
    const text = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
};
```

- [ ] **Step 2: `electron/main.js` anpassen**

- Import: `import { setMainLanguage, tm } from './i18n.js';`
- Im `whenReady`-Block ergänzen:

  ```js
          ipcMain.on('app:set-language', (_event, lang) => {
              setMainLanguage(lang);
              if (appTray) {
                  appTray.setToolTip(isDev ? `[DEV] ${tm('trayTooltip')}` : tm('trayTooltip'));
              }
              updateTrayMenu();
          });
  ```
- In `createTray`: `appTray.setToolTip(isDev ? '[DEV] Управление Умным Домом Яндекс' : 'Управление Умным Домом Яндекс')` ersetzen durch `appTray.setToolTip(isDev ? `[DEV] ${tm('trayTooltip')}` : tm('trayTooltip'))`.
- In `buildTrayMenu`: `'Открыть приложение'` durch `tm('openApp')`, `'Выход'` durch `tm('quit')`.
- In `notification:camera-stream-error`: `` title: `${deviceName} — нет видео` `` durch `title: tm('cameraNoVideo', { name: deviceName })`, `'Повторить'` durch `tm('retry')`, `'Закрыть'` durch `tm('close')`.
- In `makeRetryCallback`: `` message: `Попытка повторного подключения ${attempt} из ${maxAttempts}...` `` durch `message: tm('retryAttempt', { attempt, max: maxAttempts })`.

- [ ] **Step 3: Prüfen, dass keine sichtbaren russischen Texte übrig sind**

Run: `grep -nE "[а-яА-ЯёЁ]" electron/main.js | grep -vE "^\s*[0-9]+:\s*(//|\*)" | grep -vE "//.*[а-яА-ЯёЁ]" | grep -vE "console\."`
Expected: keine Ausgabe.

- [ ] **Step 4: Commit**

```bash
git add electron/i18n.js electron/main.js
git commit -m "Tray-Menü und Benachrichtigungen in drei Sprachen"
```

---

### Task 15: Gesamtprüfung in der laufenden App

- [ ] **Step 1:** `npm test` und `npm run build`. Expected: alles PASS, `✓ built`.
- [ ] **Step 2:** App bauen, signieren, installieren (siehe Update-Weg in der Projekt-Erinnerung; signieren mit `"Vorssaint Utils Signing"`), mit `--remote-debugging-port=9333` starten, **nur wenn Maxim die App gerade nicht benutzt** (vorher fragen).
- [ ] **Step 3:** Für jede Sprache (`de`, `en`, `ru`): über das Sprachmenü umschalten, Dashboard, Seitenleiste, Theme-Auswahl, ein Lichtfenster und das Info-Fenster öffnen, Screenshot machen, auf übrig gebliebene Fremdsprache prüfen. Tray-Menü per Rechtsklick prüfen.
- [ ] **Step 4:** Fundstellen beheben, committen, pushen.

```bash
git push
```
