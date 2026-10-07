# Plan 2: Grundgerüst der Zentrale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App spricht nicht mehr direkt mit Yandex, sondern mit einem Verteiler („Hub"), der beliebig viele Dienste zusammenführt. Dazu eine Dienste-Verwaltung („Мои сервисы") mit Anbieter-Auswahl, Anmeldung und Anleitung. Am Ende funktioniert alles wie heute, nur dass Yandex ein Dienst von mehreren ist; Xiaomi und Aqara stehen als „скоро" bereit.

**Architecture:** Neuer Ordner `core/` (TypeScript, ohne Electron), gebündelt mit esbuild zu `electron/core.js`. Jeder Dienst erfüllt die Schnittstelle `Provider`; der `Hub` lädt alle verbundenen Dienste parallel, führt Häuser und Räume per Namen zusammen und leitet Befehle anhand des ID-Präfixes weiter. Der Renderer ruft nur noch `window.api.hub.*` auf. Zugangsdaten liegen im Schlüsselbund, Yandex behält seine Einträge.

**Tech Stack:** TypeScript, esbuild, Electron 39, React 19, vitest, keytar.

**Voraussetzung:** Plan 1 (Sprachen) ist umgesetzt; alle neuen Texte gehen über `t()`.

**Spezifikation:** `docs/superpowers/specs/2026-10-07-smart-home-zentrale-design.md`

---

## Dateistruktur

| Datei | Zweck |
|---|---|
| `core/model.ts` | Typen: `ProviderId`, `HomeData`, `AccountSummary`, `HubLoadResult` |
| `core/ids.ts` | ID-Präfixe: `providerOf`, `withPrefix`, `stripPrefix` |
| `core/merge.ts` | Häuser, Räume, Geräte mehrerer Dienste zusammenführen |
| `core/provider.ts` | Schnittstellen `Provider`, `CredentialStore`, `ProviderHooks` |
| `core/hub.ts` | Verteiler: laden, Status je Dienst, Befehle weiterleiten |
| `core/providers/yandex/api.js` | bisher `electron/yandex-api.js` (verschoben) |
| `core/providers/yandex/quasar.js` | bisher `electron/yandex-quasar.js` (verschoben) |
| `core/providers/yandex/xTokenAuth.js` | bisher `electron/yandex-x-token-auth.js` (verschoben) |
| `core/providers/yandex/fillMissing.ts` | fehlende Geräte nachladen (bisher im Renderer) |
| `core/providers/yandex/index.ts` | Yandex als `Provider` |
| `core/index.ts` | öffentliche Exporte für den Hauptprozess |
| `core/*.test.ts` | Tests |
| `scripts/build-core.mjs` | esbuild: `core/index.ts` zu `electron/core.js` |
| `electron/main.js` | Hub statt Yandex-Handler, Konten-IPC |
| `electron/preload.cjs` | `api.hub.*` |
| `src/services/hub.ts` | Renderer-Aufrufe des Hubs (ersetzt `src/services/yandexIoT.ts`) |
| `src/components/services/ServicesScreen.tsx` | „Мои сервисы" |
| `src/components/services/ProviderPicker.tsx` | Kachelauswahl |
| `src/components/services/LoginGuide.tsx` | Schritt-für-Schritt-Anleitung |
| `src/components/services/YandexConnect.tsx` | Yandex-Anmeldung (Ersatz für `TokenInput`) |
| `src/components/services/providers.ts` | Anzeige-Daten je Dienst (Logo-Kürzel, verfügbar/скоро) |
| Hooks | `useAuth`, `useYandexData`, `useDeviceActions`, `useHousehold`, `App.tsx` auf den Hub umgestellt |

---

### Task 1: esbuild-Bündelung des Kerns

**Files:**
- Create: `scripts/build-core.mjs`, `core/index.ts`
- Modify: `package.json`, `.gitignore`

- [ ] **Step 1: esbuild als direkte Abhängigkeit**

Run: `npm install --save-dev esbuild@^0.25`
Expected: ohne Fehler.

- [ ] **Step 2: `scripts/build-core.mjs`**

```js
// Собирает core/ (TypeScript) в один файл electron/core.js для главного процесса.
import { build } from 'esbuild';

await build({
    entryPoints: ['core/index.ts'],
    outfile: 'electron/core.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: 'inline',
    // Нативные и Electron-модули не упаковываем
    external: ['electron', 'keytar'],
    // ESM-бандл с CommonJS-зависимостями (qrcode, tough-cookie) нуждается в require
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    logLevel: 'info',
});
```

- [ ] **Step 3: Platzhalter `core/index.ts`**

```ts
export const CORE_VERSION = 1;
```

- [ ] **Step 4: Skripte und Ignore**

In `package.json` `"scripts"` ändern:

```json
"build:core": "node scripts/build-core.mjs",
"build": "npm run build:core && vite build",
"electron-dev": "npm run build:core && node scripts/electron-wait-for-vite.js",
```

An `.gitignore` anhängen:

```
# Сгенерированный бандл ядра
/electron/core.js
```

- [ ] **Step 5: Prüfen**

Run: `npm run build:core && ls electron/core.js`
Expected: `electron/core.js` existiert.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-core.mjs core/index.ts package.json .gitignore
git commit -m "Kern-Bündelung mit esbuild"
```

---

### Task 2: Typen und ID-Präfixe

**Files:**
- Create: `core/model.ts`, `core/ids.ts`, `core/ids.test.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Failing test `core/ids.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { providerOf, stripPrefix, withPrefix } from './ids';

describe('ids', () => {
  it('Yandex-IDs bleiben ohne Präfix', () => {
    expect(withPrefix('yandex', 'a1b2-c3')).toBe('a1b2-c3');
    expect(providerOf('a1b2-c3')).toBe('yandex');
    expect(stripPrefix('a1b2-c3')).toBe('a1b2-c3');
  });
  it('andere Dienste bekommen ein Präfix', () => {
    expect(withPrefix('xiaomi', '12345')).toBe('xiaomi:12345');
    expect(providerOf('xiaomi:12345')).toBe('xiaomi');
    expect(stripPrefix('aqara:lumi.abc')).toBe('lumi.abc');
  });
  it('unbekanntes Präfix gehört zu Yandex', () => {
    expect(providerOf('foo:bar')).toBe('yandex');
    expect(stripPrefix('foo:bar')).toBe('foo:bar');
  });
});
```

- [ ] **Step 2: Test scheitert**

Run: `npx vitest run core/ids.test.ts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 3: `core/model.ts`**

```ts
// Общие типы ядра. Формат данных дома совпадает с форматом Яндекс Умного дома,
// который уже понимает интерфейс.
import type { YandexModeAction, YandexUserInfoResponse } from '../src/types/index';

export type ProviderId = 'yandex' | 'xiaomi' | 'aqara';
export const PROVIDER_IDS: ProviderId[] = ['yandex', 'xiaomi', 'aqara'];

export type HomeData = YandexUserInfoResponse;
export type ModeAction = YandexModeAction;

/** connected: работает; offline: нет связи; relogin: нужно войти снова. */
export type ProviderStatus = 'connected' | 'offline' | 'relogin';

export interface AccountSummary {
  providerId: ProviderId;
  status: ProviderStatus;
  /** Техническое сообщение последней ошибки (код вроде ERR_NETWORK). */
  error?: string;
}

export interface HubLoadResult {
  data: HomeData;
  accounts: AccountSummary[];
}
```

- [ ] **Step 4: `core/ids.ts`**

```ts
import { PROVIDER_IDS, ProviderId } from './model';

// ID Яндекса остаются без префикса, чтобы не потерять избранное и камеры.
export const withPrefix = (providerId: ProviderId, id: string): string =>
  providerId === 'yandex' ? id : `${providerId}:${id}`;

export const providerOf = (id: string): ProviderId => {
  const index = id.indexOf(':');
  if (index > 0) {
    const prefix = id.slice(0, index) as ProviderId;
    if (prefix !== 'yandex' && PROVIDER_IDS.includes(prefix)) return prefix;
  }
  return 'yandex';
};

export const stripPrefix = (id: string): string => {
  const provider = providerOf(id);
  return provider === 'yandex' ? id : id.slice(provider.length + 1);
};
```

- [ ] **Step 5: `provider_id` in die Renderer-Typen**

In `src/types/index.ts` je ein optionales Feld `provider_id?: string;` ergänzen in: `YandexScenario`, `YandexDevice`, `YandexGroup`, `YandexRoom`, `YandexHousehold`. Bei `YandexDevice` zusätzlich `household_id?: string;` (wird heute schon per `as any` gesetzt).

- [ ] **Step 6: Test besteht**

Run: `npx vitest run core/ids.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 7: Commit**

```bash
git add core/model.ts core/ids.ts core/ids.test.ts src/types/index.ts
git commit -m "Kern: Typen und ID-Präfixe"
```

---

### Task 3: Zusammenführen mehrerer Dienste

**Files:**
- Create: `core/merge.ts`, `core/merge.test.ts`

- [ ] **Step 1: Failing test `core/merge.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { mergeHomes } from './merge';
import type { HomeData } from './model';

const yandex: HomeData = {
  status: 'ok', request_id: 'y',
  households: [{ id: 'h1', name: 'Циттау' }],
  rooms: [{ id: 'r1', name: 'Кухня', household_id: 'h1', devices: ['d1'] }],
  groups: [{ id: 'g1', name: 'Свет', household_id: 'h1', devices: ['d1'], capabilities: [] }],
  devices: [{ id: 'd1', name: 'Лампа', type: 'devices.types.light', room: 'r1', household_id: 'h1', capabilities: [] }],
  scenarios: [{ id: 's1', name: 'Ночь', is_active: true }],
};

const xiaomi: HomeData = {
  status: 'ok', request_id: 'x',
  households: [{ id: 'xiaomi:home1', name: ' циттау ' }, { id: 'xiaomi:home2', name: 'Дача' }],
  rooms: [
    { id: 'xiaomi:room1', name: 'кухня', household_id: 'xiaomi:home1', devices: ['xiaomi:dev1'] },
    { id: 'xiaomi:room2', name: 'Баня', household_id: 'xiaomi:home2', devices: ['xiaomi:dev2'] },
  ],
  groups: [],
  devices: [
    { id: 'xiaomi:dev1', name: 'Розетка', type: 'devices.types.socket', room: 'xiaomi:room1', household_id: 'xiaomi:home1', capabilities: [] },
    { id: 'xiaomi:dev2', name: 'Датчик', type: 'devices.types.sensor', room: 'xiaomi:room2', household_id: 'xiaomi:home2', capabilities: [] },
  ],
  scenarios: [],
};

describe('mergeHomes', () => {
  const merged = mergeHomes([{ providerId: 'yandex', data: yandex }, { providerId: 'xiaomi', data: xiaomi }]);

  it('legt gleichnamige Häuser zusammen und behält die erste ID', () => {
    expect(merged.households.map(h => h.id)).toEqual(['h1', 'xiaomi:home2']);
  });

  it('legt gleichnamige Räume im selben Haus zusammen', () => {
    const kitchen = merged.rooms.find(r => r.id === 'r1')!;
    expect(kitchen.devices).toEqual(['d1', 'xiaomi:dev1']);
    expect(merged.rooms.map(r => r.id)).toEqual(['r1', 'xiaomi:room2']);
  });

  it('hängt Geräte an den zusammengeführten Raum und das Haus', () => {
    const socket = merged.devices.find(d => d.id === 'xiaomi:dev1')!;
    expect(socket.room).toBe('r1');
    expect(socket.household_id).toBe('h1');
  });

  it('markiert die Herkunft', () => {
    expect(merged.devices.find(d => d.id === 'd1')!.provider_id).toBe('yandex');
    expect(merged.devices.find(d => d.id === 'xiaomi:dev2')!.provider_id).toBe('xiaomi');
    expect(merged.scenarios[0].provider_id).toBe('yandex');
  });

  it('ein einzelner Dienst bleibt unverändert bis auf die Herkunft', () => {
    const single = mergeHomes([{ providerId: 'yandex', data: yandex }]);
    expect(single.devices).toHaveLength(1);
    expect(single.rooms[0].devices).toEqual(['d1']);
  });
});
```

- [ ] **Step 2: Test scheitert**

Run: `npx vitest run core/merge.test.ts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 3: `core/merge.ts`**

```ts
import type { HomeData, ProviderId } from './model';

// Дома с одинаковым названием объединяются, внутри дома объединяются комнаты.
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export interface ProviderHome {
  providerId: ProviderId;
  data: HomeData;
}

export const mergeHomes = (parts: ProviderHome[]): HomeData => {
  const result: HomeData = { status: 'ok', request_id: parts.map(p => p.data.request_id).join(','),
    households: [], rooms: [], groups: [], devices: [], scenarios: [] };

  const householdByName = new Map<string, string>();
  const householdMap = new Map<string, string>();
  const roomByKey = new Map<string, string>();
  const roomMap = new Map<string, string>();

  for (const { providerId, data } of parts) {
    for (const household of data.households) {
      const key = normalize(household.name);
      const existing = householdByName.get(key);
      if (existing) {
        householdMap.set(household.id, existing);
      } else {
        householdByName.set(key, household.id);
        householdMap.set(household.id, household.id);
        result.households.push({ ...household, provider_id: providerId });
      }
    }

    for (const room of data.rooms) {
      const householdId = householdMap.get(room.household_id) ?? room.household_id;
      const key = `${householdId}|${normalize(room.name)}`;
      const existing = roomByKey.get(key);
      if (existing) {
        roomMap.set(room.id, existing);
        result.rooms.find(r => r.id === existing)!.devices.push(...room.devices);
      } else {
        roomByKey.set(key, room.id);
        roomMap.set(room.id, room.id);
        result.rooms.push({ ...room, household_id: householdId, devices: [...room.devices], provider_id: providerId });
      }
    }

    for (const device of data.devices) {
      result.devices.push({
        ...device,
        provider_id: providerId,
        room: device.room ? roomMap.get(device.room) ?? device.room : device.room,
        household_id: device.household_id ? householdMap.get(device.household_id) ?? device.household_id : device.household_id,
      });
    }

    for (const group of data.groups) {
      result.groups.push({ ...group, provider_id: providerId,
        household_id: householdMap.get(group.household_id) ?? group.household_id });
    }

    for (const scenario of data.scenarios) {
      result.scenarios.push({ ...scenario, provider_id: providerId });
    }
  }

  return result;
};
```

- [ ] **Step 4: Test besteht**

Run: `npx vitest run core/merge.test.ts`
Expected: PASS, 5 Tests.

- [ ] **Step 5: Commit**

```bash
git add core/merge.ts core/merge.test.ts
git commit -m "Kern: Häuser und Räume mehrerer Dienste zusammenführen"
```

---

### Task 4: Provider-Schnittstelle und Hub

**Files:**
- Create: `core/provider.ts`, `core/hub.ts`, `core/hub.test.ts`

- [ ] **Step 1: `core/provider.ts`**

```ts
import type { HomeData, ModeAction, ProviderId } from './model';

/** Хранилище секретов (на компьютере: связка ключей через keytar). */
export interface CredentialStore {
  get(account: string): Promise<string | null>;
  set(account: string, value: string): Promise<void>;
  delete(account: string): Promise<void>;
}

export interface ProviderHooks {
  /** Сообщает интерфейсу о повторной попытке подключения. */
  onRetryAttempt?: (action: string, attempt: number, maxAttempts: number) => void;
}

/**
 * Один сервис умного дома. Все ID на входе уже без префикса,
 * все ID на выходе (loadHome) уже с префиксом (см. ids.ts).
 */
export interface Provider {
  id: ProviderId;
  isConfigured(): Promise<boolean>;
  /** Проверяет данные входа и сохраняет их. Бросает ERR_AUTH при неверных данных. */
  connect(payload: Record<string, string>): Promise<void>;
  disconnect(): Promise<void>;
  loadHome(options: { retry: boolean }): Promise<HomeData>;
  toggleDevice(deviceId: string, newState: boolean): Promise<void>;
  setDeviceMode(deviceId: string, actions: ModeAction[], turnOn: boolean): Promise<void>;
  toggleGroup(groupId: string, deviceIds: string[], newState: boolean): Promise<void>;
  runScenario(scenarioId: string): Promise<void>;
}
```

- [ ] **Step 2: Failing test `core/hub.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { Hub } from './hub';
import type { Provider } from './provider';
import type { HomeData, ProviderId } from './model';

const home = (prefix: string, householdName: string): HomeData => ({
  status: 'ok', request_id: prefix,
  households: [{ id: `${prefix}h`, name: householdName }],
  rooms: [], groups: [],
  devices: [{ id: `${prefix}d`, name: 'D', type: 'devices.types.socket', capabilities: [] }],
  scenarios: [],
});

const fakeProvider = (id: ProviderId, overrides: Partial<Provider> = {}): Provider => ({
  id,
  isConfigured: vi.fn(async () => true),
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  loadHome: vi.fn(async () => home(id === 'yandex' ? '' : `${id}:`, 'Дом')),
  toggleDevice: vi.fn(async () => {}),
  setDeviceMode: vi.fn(async () => {}),
  toggleGroup: vi.fn(async () => {}),
  runScenario: vi.fn(async () => {}),
  ...overrides,
});

describe('Hub', () => {
  it('lädt alle verbundenen Dienste und führt sie zusammen', async () => {
    const hub = new Hub([fakeProvider('yandex'), fakeProvider('xiaomi')]);
    const result = await hub.loadHome({ retry: false });
    expect(result.data.devices.map(d => d.id)).toEqual(['d', 'xiaomi:d']);
    expect(result.accounts).toEqual([
      { providerId: 'yandex', status: 'connected' },
      { providerId: 'xiaomi', status: 'connected' },
    ]);
  });

  it('ein ausgefallener Dienst bremst die anderen nicht', async () => {
    const broken = fakeProvider('xiaomi', { loadHome: vi.fn(async () => { throw new Error('ERR_NETWORK'); }) });
    const hub = new Hub([fakeProvider('yandex'), broken]);
    const result = await hub.loadHome({ retry: false });
    expect(result.data.devices.map(d => d.id)).toEqual(['d']);
    expect(result.accounts[1]).toEqual({ providerId: 'xiaomi', status: 'offline', error: 'ERR_NETWORK' });
  });

  it('abgelaufene Anmeldung wird als relogin gemeldet', async () => {
    const expired = fakeProvider('yandex', { loadHome: vi.fn(async () => { throw new Error('ERR_AUTH'); }) });
    const hub = new Hub([expired, fakeProvider('xiaomi')]);
    const result = await hub.loadHome({ retry: false });
    expect(result.accounts[0].status).toBe('relogin');
  });

  it('wirft, wenn alle Dienste ausfallen', async () => {
    const hub = new Hub([fakeProvider('yandex', { loadHome: vi.fn(async () => { throw new Error('ERR_NETWORK'); }) })]);
    await expect(hub.loadHome({ retry: false })).rejects.toThrow('ERR_NETWORK');
  });

  it('nicht verbundene Dienste werden übersprungen', async () => {
    const hub = new Hub([fakeProvider('yandex'), fakeProvider('aqara', { isConfigured: vi.fn(async () => false) })]);
    const result = await hub.loadHome({ retry: false });
    expect(result.accounts.map(a => a.providerId)).toEqual(['yandex']);
  });

  it('leitet Befehle anhand des Präfixes weiter und entfernt es', async () => {
    const yandex = fakeProvider('yandex');
    const xiaomi = fakeProvider('xiaomi');
    const hub = new Hub([yandex, xiaomi]);
    await hub.toggleDevice('xiaomi:42', true);
    await hub.toggleDevice('abc-uuid', false);
    await hub.toggleGroup('xiaomi:g1', ['xiaomi:1', 'xiaomi:2'], true);
    expect(xiaomi.toggleDevice).toHaveBeenCalledWith('42', true);
    expect(yandex.toggleDevice).toHaveBeenCalledWith('abc-uuid', false);
    expect(xiaomi.toggleGroup).toHaveBeenCalledWith('g1', ['1', '2'], true);
  });

  it('meldet keine verbundenen Dienste mit leerer Liste', async () => {
    const hub = new Hub([fakeProvider('yandex', { isConfigured: vi.fn(async () => false) })]);
    expect(await hub.accounts()).toEqual([]);
  });
});
```

- [ ] **Step 3: Test scheitert**

Run: `npx vitest run core/hub.test.ts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 4: `core/hub.ts`**

```ts
import { providerOf, stripPrefix } from './ids';
import { mergeHomes, ProviderHome } from './merge';
import type { AccountSummary, HubLoadResult, ModeAction, ProviderId } from './model';
import type { Provider } from './provider';

/** Распределитель: собирает все подключённые сервисы и направляет команды. */
export class Hub {
  private lastStatus = new Map<ProviderId, AccountSummary>();

  constructor(private readonly providers: Provider[]) {}

  private provider(id: ProviderId): Provider {
    const provider = this.providers.find(p => p.id === id);
    if (!provider) throw new Error(`ERR_UNKNOWN_PROVIDER ${id}`);
    return provider;
  }

  private async configured(): Promise<Provider[]> {
    const flags = await Promise.all(this.providers.map(p => p.isConfigured()));
    return this.providers.filter((_, index) => flags[index]);
  }

  async accounts(): Promise<AccountSummary[]> {
    return (await this.configured()).map(p => this.lastStatus.get(p.id) ?? { providerId: p.id, status: 'connected' });
  }

  async connect(providerId: ProviderId, payload: Record<string, string>): Promise<void> {
    await this.provider(providerId).connect(payload);
    this.lastStatus.set(providerId, { providerId, status: 'connected' });
  }

  async disconnect(providerId: ProviderId): Promise<void> {
    await this.provider(providerId).disconnect();
    this.lastStatus.delete(providerId);
  }

  async loadHome(options: { retry: boolean }): Promise<HubLoadResult> {
    const active = await this.configured();
    const results = await Promise.allSettled(active.map(p => p.loadHome(options)));

    const homes: ProviderHome[] = [];
    const accounts: AccountSummary[] = [];
    let firstError: unknown;

    results.forEach((result, index) => {
      const providerId = active[index].id;
      if (result.status === 'fulfilled') {
        homes.push({ providerId, data: result.value });
        accounts.push({ providerId, status: 'connected' });
      } else {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        firstError ??= result.reason;
        accounts.push({ providerId, status: message === 'ERR_AUTH' ? 'relogin' : 'offline', error: message });
      }
    });

    accounts.forEach(a => this.lastStatus.set(a.providerId, a));
    if (homes.length === 0 && firstError) throw firstError;
    return { data: mergeHomes(homes), accounts };
  }

  toggleDevice(deviceId: string, newState: boolean) {
    return this.provider(providerOf(deviceId)).toggleDevice(stripPrefix(deviceId), newState);
  }

  setDeviceMode(deviceId: string, actions: ModeAction[], turnOn: boolean) {
    return this.provider(providerOf(deviceId)).setDeviceMode(stripPrefix(deviceId), actions, turnOn);
  }

  toggleGroup(groupId: string, deviceIds: string[], newState: boolean) {
    return this.provider(providerOf(groupId)).toggleGroup(stripPrefix(groupId), deviceIds.map(stripPrefix), newState);
  }

  runScenario(scenarioId: string) {
    return this.provider(providerOf(scenarioId)).runScenario(stripPrefix(scenarioId));
  }
}
```

- [ ] **Step 5: Test besteht**

Run: `npx vitest run core/hub.test.ts`
Expected: PASS, 7 Tests.

- [ ] **Step 6: Commit**

```bash
git add core/provider.ts core/hub.ts core/hub.test.ts
git commit -m "Kern: Provider-Schnittstelle und Hub"
```

---

### Task 5: Yandex-Dateien in den Kern verschieben

**Files:**
- Move: `electron/yandex-api.js` → `core/providers/yandex/api.js`
- Move: `electron/yandex-quasar.js` → `core/providers/yandex/quasar.js`
- Move: `electron/yandex-x-token-auth.js` → `core/providers/yandex/xTokenAuth.js`

- [ ] **Step 1: Verschieben mit Historie**

```bash
mkdir -p core/providers/yandex
git mv electron/yandex-api.js core/providers/yandex/api.js
git mv electron/yandex-quasar.js core/providers/yandex/quasar.js
git mv electron/yandex-x-token-auth.js core/providers/yandex/xTokenAuth.js
```

- [ ] **Step 2: Interne Importe anpassen**

In `core/providers/yandex/api.js`: `from './yandex-quasar.js'` → `from './quasar.js'`.
Prüfen: `grep -n "from '\./" core/providers/yandex/*.js` zeigt nur noch existierende Dateien.

- [ ] **Step 3: Vorläufig über `core/index.ts` exportieren**

`core/index.ts` ersetzen:

```ts
export * as yandexApi from './providers/yandex/api.js';
export { clearQuasarSessionCache } from './providers/yandex/quasar.js';
export { startQrAuth, pollQrAuth, cancelQrAuth, validateStoredXToken } from './providers/yandex/xTokenAuth.js';
```

- [ ] **Step 4: `electron/main.js` auf den Bundle umstellen**

Die Importzeilen

```js
import * as yandexApi from './yandex-api.js';
import {
    startQrAuth,
    pollQrAuth,
    cancelQrAuth,
    validateStoredXToken,
} from './yandex-x-token-auth.js';
import { clearQuasarSessionCache } from './yandex-quasar.js';
```

ersetzen durch

```js
import {
    yandexApi,
    startQrAuth,
    pollQrAuth,
    cancelQrAuth,
    validateStoredXToken,
    clearQuasarSessionCache,
} from './core.js';
```

- [ ] **Step 5: Build und Start prüfen**

Run: `npm run build`
Expected: esbuild meldet `electron/core.js`, Vite `✓ built`.

Run: `npx electron . --version` ist kein Funktionstest; stattdessen in Task 9 in der App prüfen. Hier nur: `node -e "import('./electron/core.js').then(m => console.log(Object.keys(m)))"`
Expected: Ausgabe enthält `yandexApi`, `startQrAuth`, `clearQuasarSessionCache`. Fehlt `keytar`/`electron` nicht, weil sie nicht importiert werden.

- [ ] **Step 6: Commit**

```bash
git add -A core electron/main.js
git commit -m "Yandex-Code in den Kern verschoben"
```

---

### Task 6: Fehlende Yandex-Geräte im Kern nachladen

**Files:**
- Create: `core/providers/yandex/fillMissing.ts`, `core/providers/yandex/fillMissing.test.ts`

Hintergrund: `src/services/yandexIoT.ts` lädt heute Geräte nach, die in Räumen stehen, aber in `devices` fehlen. Das wandert in den Kern.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { fillMissingDevices } from './fillMissing';
import type { HomeData } from '../../model';

const base: HomeData = {
  status: 'ok', request_id: 'r', households: [], groups: [], scenarios: [],
  rooms: [{ id: 'room', name: 'Кухня', household_id: 'h', devices: ['known', 'missing'] }],
  devices: [{ id: 'known', name: 'A', type: 'devices.types.light', capabilities: [] }],
};

describe('fillMissingDevices', () => {
  it('lädt fehlende Geräte nach und setzt Raum und Haus', async () => {
    const fetchDevice = vi.fn(async (id: string) => ({ id, name: 'B', type: 'devices.types.socket', capabilities: [] }));
    const result = await fillMissingDevices(base, fetchDevice);
    expect(fetchDevice).toHaveBeenCalledWith('missing');
    const added = result.devices.find(d => d.id === 'missing')!;
    expect(added.room).toBe('room');
    expect(added.household_id).toBe('h');
  });

  it('überspringt Geräte, die nicht geladen werden können', async () => {
    const result = await fillMissingDevices(base, async () => { throw new Error('ERR_HTTP 404'); });
    expect(result.devices.map(d => d.id)).toEqual(['known']);
  });

  it('ändert nichts, wenn nichts fehlt', async () => {
    const complete = { ...base, rooms: [{ ...base.rooms[0], devices: ['known'] }] };
    const fetchDevice = vi.fn();
    expect(await fillMissingDevices(complete, fetchDevice)).toBe(complete);
    expect(fetchDevice).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Test scheitert**

Run: `npx vitest run core/providers/yandex/fillMissing.test.ts`
Expected: FAIL, Modul fehlt.

- [ ] **Step 3: `core/providers/yandex/fillMissing.ts`**

```ts
import type { YandexDevice } from '../../../src/types/index';
import type { HomeData } from '../../model';

/** Догружает устройства, которые есть в комнатах, но отсутствуют в списке устройств. */
export const fillMissingDevices = async (
  info: HomeData,
  fetchDevice: (deviceId: string) => Promise<YandexDevice>,
): Promise<HomeData> => {
  const known = new Set(info.devices.map(d => d.id));
  const missing = [...new Set(info.rooms.flatMap(r => r.devices))].filter(id => !known.has(id));
  if (missing.length === 0) return info;

  const fetched: YandexDevice[] = [];
  for (const deviceId of missing) {
    try {
      const device = await fetchDevice(deviceId);
      const room = info.rooms.find(r => r.devices.includes(deviceId));
      fetched.push({ ...device, room: device.room ?? room?.id, household_id: device.household_id ?? room?.household_id });
    } catch {
      // Устройство недоступно: показываем остальные
    }
  }
  return { ...info, devices: [...info.devices, ...fetched] };
};
```

- [ ] **Step 4: Test besteht**

Run: `npx vitest run core/providers/yandex/fillMissing.test.ts`
Expected: PASS, 3 Tests.

- [ ] **Step 5: Commit**

```bash
git add core/providers/yandex/fillMissing.ts core/providers/yandex/fillMissing.test.ts
git commit -m "Yandex: fehlende Geräte im Kern nachladen"
```

---

### Task 7: Yandex als Provider

**Files:**
- Create: `core/providers/yandex/index.ts`, `core/providers/yandex/provider.test.ts`
- Modify: `core/index.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({
  fetchUserInfo: vi.fn(async () => ({ status: 'ok', request_id: 'r', households: [], rooms: [], groups: [], devices: [], scenarios: [] })),
  fetchDevice: vi.fn(),
  toggleDevice: vi.fn(async () => {}),
  setDeviceMode: vi.fn(async () => {}),
  toggleGroup: vi.fn(async () => {}),
  executeScenario: vi.fn(async () => {}),
}));

import * as api from './api.js';
import { createYandexProvider, YANDEX_TOKEN_ACCOUNT, YANDEX_XTOKEN_ACCOUNT } from './index';
import type { CredentialStore } from '../../provider';

const memoryStore = (initial: Record<string, string> = {}): CredentialStore => {
  const data = new Map(Object.entries(initial));
  return {
    get: async key => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); },
    delete: async key => { data.delete(key); },
  };
};

describe('Yandex-Provider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ist ohne Token nicht verbunden', async () => {
    expect(await createYandexProvider(memoryStore(), {}).isConfigured()).toBe(false);
  });

  it('connect prüft den Token und speichert ihn', async () => {
    const store = memoryStore();
    await createYandexProvider(store, {}).connect({ token: ' abc ' });
    expect(api.fetchUserInfo).toHaveBeenCalledWith('abc', null, { retry: false });
    expect(await store.get(YANDEX_TOKEN_ACCOUNT)).toBe('abc');
  });

  it('connect ohne Token ist ERR_AUTH', async () => {
    await expect(createYandexProvider(memoryStore(), {}).connect({ token: '' })).rejects.toThrow('ERR_AUTH');
  });

  it('Befehle verwenden den gespeicherten Token', async () => {
    const provider = createYandexProvider(memoryStore({ [YANDEX_TOKEN_ACCOUNT]: 't' }), {});
    await provider.toggleDevice('dev', true);
    await provider.runScenario('sc');
    expect(api.toggleDevice).toHaveBeenCalledWith('t', 'dev', true, null);
    expect(api.executeScenario).toHaveBeenCalledWith('t', 'sc', null);
  });

  it('disconnect löscht Token und QR-Anmeldung', async () => {
    const store = memoryStore({ [YANDEX_TOKEN_ACCOUNT]: 't', [YANDEX_XTOKEN_ACCOUNT]: 'x' });
    await createYandexProvider(store, {}).disconnect();
    expect(await store.get(YANDEX_TOKEN_ACCOUNT)).toBeNull();
    expect(await store.get(YANDEX_XTOKEN_ACCOUNT)).toBeNull();
  });
});
```

- [ ] **Step 2: Test scheitert**

Run: `npx vitest run core/providers/yandex/provider.test.ts`
Expected: FAIL, `createYandexProvider` fehlt.

- [ ] **Step 3: `core/providers/yandex/index.ts`**

```ts
import * as api from './api.js';
import { fillMissingDevices } from './fillMissing';
import type { CredentialStore, Provider, ProviderHooks } from '../../provider';
import type { HomeData, ModeAction } from '../../model';

// Прежние имена записей в связке ключей: пользователю не нужно входить заново.
export const YANDEX_TOKEN_ACCOUNT = 'YandexToken';
export const YANDEX_XTOKEN_ACCOUNT = 'YandexXToken';

export const createYandexProvider = (store: CredentialStore, hooks: ProviderHooks): Provider => {
  const token = async () => {
    const value = await store.get(YANDEX_TOKEN_ACCOUNT);
    if (!value) throw new Error('ERR_AUTH');
    return value;
  };

  // Повторные попытки показываем только при явной загрузке, как раньше
  const retry = (action: string, enabled = true) =>
    enabled && hooks.onRetryAttempt
      ? (attempt: number, max: number) => hooks.onRetryAttempt!(action, attempt, max)
      : null;

  return {
    id: 'yandex',

    async isConfigured() {
      return Boolean(await store.get(YANDEX_TOKEN_ACCOUNT));
    },

    async connect(payload) {
      const value = (payload.token ?? '').trim();
      if (!value) throw new Error('ERR_AUTH');
      await api.fetchUserInfo(value, null, { retry: false });
      await store.set(YANDEX_TOKEN_ACCOUNT, value);
    },

    async disconnect() {
      await store.delete(YANDEX_TOKEN_ACCOUNT);
      await store.delete(YANDEX_XTOKEN_ACCOUNT);
    },

    async loadHome({ retry: withRetry }) {
      const t = await token();
      const info = (await api.fetchUserInfo(t, retry('fetchUserInfo', withRetry), { retry: withRetry })) as HomeData;
      return fillMissingDevices(info, deviceId => api.fetchDevice(t, deviceId, null));
    },

    async toggleDevice(deviceId, newState) {
      await api.toggleDevice(await token(), deviceId, newState, retry('toggleDevice', false));
    },

    async setDeviceMode(deviceId, actions: ModeAction[], turnOn) {
      await api.setDeviceMode(await token(), deviceId, actions, turnOn, retry('setDeviceMode', false));
    },

    async toggleGroup(groupId, deviceIds, newState) {
      await api.toggleGroup(await token(), groupId, deviceIds, newState, retry('toggleGroup', false));
    },

    async runScenario(scenarioId) {
      await api.executeScenario(await token(), scenarioId, retry('executeScenario', false));
    },
  };
};
```

Hinweis: `retry(…, false)` liefert `null`, damit Befehle wie bisher nicht mit Wiederholungsmeldungen arbeiten; der Test erwartet genau dieses `null`.

- [ ] **Step 4: `core/index.ts` erweitern**

```ts
export * as yandexApi from './providers/yandex/api.js';
export { clearQuasarSessionCache } from './providers/yandex/quasar.js';
export { startQrAuth, pollQrAuth, cancelQrAuth, validateStoredXToken } from './providers/yandex/xTokenAuth.js';
export { Hub } from './hub';
export { createYandexProvider, YANDEX_TOKEN_ACCOUNT, YANDEX_XTOKEN_ACCOUNT } from './providers/yandex/index';
export type { CredentialStore, Provider, ProviderHooks } from './provider';
export type { AccountSummary, HubLoadResult, ProviderId } from './model';
```

- [ ] **Step 5: Tests und Bündel**

Run: `npx vitest run core && npm run build:core`
Expected: alle PASS, Bündel ohne Fehler.

- [ ] **Step 6: Commit**

```bash
git add core
git commit -m "Yandex als Provider des Hubs"
```

---

### Task 8: Hauptprozess und Preload auf den Hub umstellen

**Files:**
- Modify: `electron/main.js`, `electron/preload.cjs`, `src/types/electron-api.d.ts`

- [ ] **Step 1: Hub im Hauptprozess erzeugen**

In `electron/main.js` den Import aus `./core.js` um `Hub, createYandexProvider, YANDEX_TOKEN_ACCOUNT` erweitern. Nach den keytar-Hilfsfunktionen einfügen:

```js
// Связка ключей как хранилище секретов для ядра
const credentialStore = {
    get: (account) => keytar.getPassword(SERVICE_NAME, account),
    set: (account, value) => keytar.setPassword(SERVICE_NAME, account, value),
    delete: async (account) => { await keytar.deletePassword(SERVICE_NAME, account); },
};

const providerHooks = {
    onRetryAttempt: (action, attempt, maxAttempts) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('yandex-api:retry-attempt', {
                action, attempt, maxAttempts,
                message: tm('retryAttempt', { attempt, max: maxAttempts }),
            });
        }
    },
};

const hub = new Hub([createYandexProvider(credentialStore, providerHooks)]);
```

`ACCOUNT_NAME` bleibt für die Kamera-Handler bestehen; sein Wert ist `YANDEX_TOKEN_ACCOUNT` (`'YandexToken'`), also identisch.

- [ ] **Step 2: Hub-Handler registrieren**

Im `whenReady`-Block die Handler `yandex-api:fetchUserInfo`, `yandex-api:executeScenario`, `yandex-api:toggleDevice`, `yandex-api:setDeviceMode`, `yandex-api:toggleGroup`, `yandex-api:fetchDevice`, `secure:getToken`, `secure:setToken`, `secure:deleteToken` entfernen und ersetzen durch:

```js
        const rethrow = (error) => { throw new Error(error.message, { cause: error }); };

        ipcMain.handle('hub:accounts', () => hub.accounts());
        ipcMain.handle('hub:connect', (_e, providerId, payload) => hub.connect(providerId, payload).catch(rethrow));
        ipcMain.handle('hub:disconnect', async (_e, providerId) => {
            await hub.disconnect(providerId);
            if (providerId === 'yandex') {
                clearQuasarSessionCache();
                cancelQrAuth();
            }
        });
        ipcMain.handle('hub:loadHome', (_e, options = {}) =>
            runSingleFlight(`loadHome:${options.retry !== false}`, () => hub.loadHome({ retry: options.retry !== false })).catch(rethrow));
        ipcMain.handle('hub:toggleDevice', (_e, id, state) => hub.toggleDevice(id, state).catch(rethrow));
        ipcMain.handle('hub:setDeviceMode', (_e, id, actions, turnOn) => hub.setDeviceMode(id, actions, turnOn).catch(rethrow));
        ipcMain.handle('hub:toggleGroup', (_e, id, deviceIds, state) => hub.toggleGroup(id, deviceIds, state).catch(rethrow));
        ipcMain.handle('hub:runScenario', (_e, id) => hub.runScenario(id).catch(rethrow));
```

Die Kamera-Handler (`yandex-api:getCameraStream`, `setCameraPrivacyMode`, `getQuasarCameraDevice`) und `yandex-auth:*` bleiben unverändert; sie nutzen `yandexApi` aus `./core.js`.

- [ ] **Step 3: Preload**

In `electron/preload.cjs` die Einträge `fetchUserInfo`, `executeScenario`, `toggleDevice`, `toggleGroup`, `setDeviceMode`, `fetchDevice`, `getSecureToken`, `setSecureToken`, `deleteSecureToken` entfernen und ergänzen:

```js
    hub: {
        accounts: () => ipcRenderer.invoke('hub:accounts'),
        connect: (providerId, payload) => ipcRenderer.invoke('hub:connect', providerId, payload),
        disconnect: (providerId) => ipcRenderer.invoke('hub:disconnect', providerId),
        loadHome: (options) => ipcRenderer.invoke('hub:loadHome', options),
        toggleDevice: (deviceId, newState) => ipcRenderer.invoke('hub:toggleDevice', deviceId, newState),
        setDeviceMode: (deviceId, actions, turnOn) => ipcRenderer.invoke('hub:setDeviceMode', deviceId, actions, turnOn),
        toggleGroup: (groupId, deviceIds, newState) => ipcRenderer.invoke('hub:toggleGroup', groupId, deviceIds, newState),
        runScenario: (scenarioId) => ipcRenderer.invoke('hub:runScenario', scenarioId),
    },
```

- [ ] **Step 4: Typen**

In `src/types/electron-api.d.ts`: die entfernten Methoden aus `IYandexApi` streichen und ergänzen:

```ts
export type ProviderId = 'yandex' | 'xiaomi' | 'aqara';
export interface AccountSummary {
    providerId: ProviderId;
    status: 'connected' | 'offline' | 'relogin';
    error?: string;
}
export interface IHubApi {
    accounts: () => Promise<AccountSummary[]>;
    connect: (providerId: ProviderId, payload: Record<string, string>) => Promise<void>;
    disconnect: (providerId: ProviderId) => Promise<void>;
    loadHome: (options?: { retry?: boolean }) => Promise<{ data: YandexUserInfoResponse; accounts: AccountSummary[] }>;
    toggleDevice: (deviceId: string, newState: boolean) => Promise<void>;
    setDeviceMode: (deviceId: string, actions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    toggleGroup: (groupId: string, deviceIds: string[], newState: boolean) => Promise<void>;
    runScenario: (scenarioId: string) => Promise<void>;
}
```

und in `IYandexApi` das Feld `hub: IHubApi;`.

- [ ] **Step 5: Bündel bauen**

Run: `npm run build:core`
Expected: ohne Fehler. (Der Renderer baut erst nach Task 9 wieder.)

- [ ] **Step 6: Commit**

```bash
git add electron/main.js electron/preload.cjs src/types/electron-api.d.ts
git commit -m "Hauptprozess spricht über den Hub"
```

---

### Task 9: Renderer auf den Hub umstellen

**Files:**
- Create: `src/services/hub.ts`
- Delete: `src/services/yandexIoT.ts` (Kamera-Funktionen wandern nach `src/services/camera.ts`)
- Create: `src/services/camera.ts`
- Modify: `src/hooks/useAuth.ts`, `src/hooks/useYandexData.ts`, `src/hooks/useDeviceActions.ts`, `src/hooks/useHousehold.ts`, `src/App.tsx`

- [ ] **Step 1: `src/services/hub.ts`**

```ts
import type { YandexModeAction, YandexUserInfoResponse } from '../types/index';
import type { AccountSummary, ProviderId } from '../types/electron-api';

const hub = () => window.api.hub;

export const listAccounts = (): Promise<AccountSummary[]> => hub().accounts();
export const connectProvider = (providerId: ProviderId, payload: Record<string, string>) => hub().connect(providerId, payload);
export const disconnectProvider = (providerId: ProviderId) => hub().disconnect(providerId);
export const loadHome = (options?: { retry?: boolean }): Promise<{ data: YandexUserInfoResponse; accounts: AccountSummary[] }> =>
    hub().loadHome(options);
export const toggleDevice = (deviceId: string, newState: boolean) => hub().toggleDevice(deviceId, newState);
export const setDeviceMode = (deviceId: string, actions: YandexModeAction[], turnOn = false) =>
    hub().setDeviceMode(deviceId, actions, turnOn);
export const toggleGroup = (groupId: string, deviceIds: string[], newState: boolean) =>
    hub().toggleGroup(groupId, deviceIds, newState);
export const runScenario = (scenarioId: string) => hub().runScenario(scenarioId);
```

- [ ] **Step 2: `src/services/camera.ts`**

Die drei Funktionen `getCameraStream`, `setCameraPrivacyMode`, `getQuasarCameraDevice` aus `src/services/yandexIoT.ts` unverändert hierher kopieren (inklusive `const yandexApi = window.api;` und der Typ-Importe). Danach `git rm src/services/yandexIoT.ts` und alle Importe anpassen:

Run: `grep -rn "services/yandexIoT" src`
Expected nach dem Anpassen: keine Treffer.

- [ ] **Step 3: `useAuth` von Token auf Konten umstellen**

In `src/hooks/useAuth.ts`:
- Zustand `token` ersetzen durch `accounts: AccountSummary[]` (`useState<AccountSummary[]>([])`), Rückgabe `token`/`setToken` ersetzen durch `accounts`/`setAccounts`.
- `loadData(apiToken)` wird `loadData()`: ruft `loadHome()` aus `../services/hub`, setzt `setUserData(stableSortData(result.data))`, `setAccounts(result.accounts)`, `AppState.DASHBOARD`. Im Fehlerfall `setErrorMsg(cleanErrorMessage(err, t))` und `AppState.AUTH`; **kein** Löschen des Tokens mehr (der Hub meldet `relogin`).
- Start-Effekt: `listAccounts()`; leer → `AppState.AUTH`; sonst `loadData()`.
- `handleTokenSubmit(newToken)` wird `handleConnected()`: nach erfolgreichem `connectProvider` (wird in der Anmeldekomponente aufgerufen) einfach `loadData()`.
- `handleLogout` und `handleCancelRetry` entfallen; `handleCancelRetry` wird durch `() => setAppState(AppState.AUTH)` ersetzt (Dienste-Seite statt Token löschen).
- `t` kommt über einen Parameter `t: (key: string) => string` in den Hook (Aufruf in `App.tsx` mit `useI18n().t`).

`src/App.tsx` hat eine eigene Kopie dieser Logik (`handleLoadData`, `handleTokenSubmit`, `handleLogout`, `handleCancelRetry`, Init-Effekt). Diese Kopie löschen und die Funktionen aus `useAuth` verwenden, damit es nur noch eine Stelle gibt.

- [ ] **Step 4: `useYandexData`, `useDeviceActions`, `useHousehold`**

- `useYandexData`: Parameter `token`/`setToken` entfernen; `refreshDashboardData(apiToken, silent)` wird `refreshDashboardData(silent = false)` und ruft `loadHome({ retry: !silent })`; Ergebnis-`accounts` über einen neuen Parameter `setAccounts` weitergeben. Der 401/403-Zweig entfällt.
- `useDeviceActions`: Parameter `token` entfernen; `toggleDevice(token, id, s)` → `toggleDevice(id, s)`, `toggleGroup(token, …)` → `toggleGroup(…)`, `executeScenario(token, id)` → `runScenario(id)`, `setDeviceMode(token, …)` → `setDeviceMode(…)`; `refreshDashboardData(token)` → `refreshDashboardData()`; Wächter `if (!token …)` → `if (!userData)` bzw. entfernen.
- `useHousehold`: den Parameter `token` entfernen; dort, wo `refreshDashboardData(token)` aufgerufen wird, `refreshDashboardData()`.
- `App.tsx`: Polling-Effekt prüft statt `!token` jetzt `accounts.length === 0`; `onRefresh: () => refreshDashboardData()`; Tray-Effekt-Abhängigkeit `token` streichen.

Run: `grep -rn "\btoken\b" src/hooks src/App.tsx | grep -v "x-token\|xToken\|XToken"`
Expected: keine Treffer mehr, die den Yandex-OAuth-Token meinen.

- [ ] **Step 5: Build und Tests**

Run: `npm test && npm run build`
Expected: alle PASS, `✓ built`.

- [ ] **Step 6: App-Test mit bestehendem Konto**

App bauen, signieren (`"Vorssaint Utils Signing"`), installieren, starten (Maxim vorher fragen). Erwartet: Das Dashboard erscheint **ohne** neue Anmeldung (Token aus `YandexToken` wird übernommen), Geräte schalten, Szenario starten, Kamera öffnen funktionieren wie vorher.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "Renderer nutzt den Hub statt Yandex direkt"
```

---

### Task 10: Anzeige-Daten der Dienste und Anleitung

**Files:**
- Create: `src/components/services/providers.ts`, `src/components/services/LoginGuide.tsx`
- Modify: `src/i18n/ru.ts`, `src/i18n/en.ts`, `src/i18n/de.ts`

- [ ] **Step 1: `providers.ts`**

```ts
import type { ProviderId } from '../../types/electron-api';

export interface ProviderInfo {
  id: ProviderId;
  /** Короткая метка на карточке устройства. */
  badge: string;
  /** Цвет логотипа-плашки. */
  color: string;
  available: boolean;
}

// Xiaomi и Aqara включаются в планах 3 и 4.
export const PROVIDERS: ProviderInfo[] = [
  { id: 'yandex', badge: 'Я', color: '#FC3F1D', available: true },
  { id: 'xiaomi', badge: 'Mi', color: '#FF6900', available: false },
  { id: 'aqara', badge: 'Aqara', color: '#1F1F1F', available: false },
];

export const providerInfo = (id: string | undefined): ProviderInfo =>
  PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];
```

- [ ] **Step 2: `LoginGuide.tsx`**

```tsx
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface LoginGuideProps {
  /** Префикс ключей, например 'services.yandex.guide'. Ожидаются steps.1..N, problems.1..M, title. */
  base: string;
  stepCount: number;
  problemCount: number;
  links?: Record<string, string>;
}

/** Пошаговая инструкция рядом с формой входа. Ссылки в тексте: {link:имя}. */
export const LoginGuide: React.FC<LoginGuideProps> = ({ base, stepCount, problemCount, links = {} }) => {
  const { t } = useI18n();

  const renderText = (text: string) =>
    text.split(/(\{link:\w+\})/g).map((part, index) => {
      const match = part.match(/^\{link:(\w+)\}$/);
      if (!match || !links[match[1]]) return <React.Fragment key={index}>{part}</React.Fragment>;
      return (
        <a key={index} href={links[match[1]]} target="_blank" rel="noreferrer" className="login-guide-link">
          {links[match[1]].replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    });

  return (
    <aside className="login-guide">
      <h3>{t(`${base}.title`)}</h3>
      <ol>
        {Array.from({ length: stepCount }, (_, i) => (
          <li key={i}>{renderText(t(`${base}.steps.${i + 1}`))}</li>
        ))}
      </ol>
      {problemCount > 0 && (
        <>
          <h4>{t('services.guideProblems')}</h4>
          <ul>
            {Array.from({ length: problemCount }, (_, i) => (
              <li key={i}>{renderText(t(`${base}.problems.${i + 1}`))}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
};
```

Externe Links: Electron öffnet `target="_blank"` heute in einem neuen Electron-Fenster. In `electron/main.js` in `createWindow` ergänzen, damit sie im normalen Browser aufgehen:

```js
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
```

(`shell` im Electron-Import ergänzen.)

- [ ] **Step 3: Texte in allen drei Sprachen**

In `ru.ts`, `en.ts`, `de.ts` einen Abschnitt `services` ergänzen. Russisch:

```ts
services: {
  title: 'Мои сервисы',
  add: 'Добавить сервис',
  choose: 'Выберите сервис',
  soon: 'скоро',
  disconnect: 'Отключить',
  disconnectConfirm: 'Отключить «{name}»? Данные для входа будут удалены, устройства исчезнут из приложения.',
  relogin: 'Войти снова',
  empty: 'Пока не подключено ни одного сервиса. Добавьте первый, чтобы увидеть свои устройства.',
  guideProblems: 'Если не получается',
  status: { connected: 'подключено', offline: 'нет связи', relogin: 'войдите снова' },
  names: { yandex: 'Яндекс', xiaomi: 'Xiaomi Home', aqara: 'Aqara' },
  yandex: {
    tokenLabel: 'OAuth-токен Умного дома Яндекса',
    connect: 'Подключить',
    guide: {
      title: 'Как войти',
      steps: {
        1: 'Откройте {link:oauth} и войдите в свой аккаунт Яндекса.',
        2: 'Нажмите «Создать приложение», выберите «Для доступа к API или отладки».',
        3: 'Впишите любое название и добавьте два доступа: iot:view и iot:control.',
        4: 'Скопируйте ClientID созданного приложения.',
        5: 'Откройте https://oauth.yandex.ru/authorize?response_type=token&client_id=ВАШ_CLIENTID и подтвердите доступ.',
        6: 'Скопируйте показанный токен и вставьте его слева.',
      },
      problems: {
        1: 'Ошибка авторизации: в приложении не хватает доступов iot:view и iot:control.',
        2: 'Токен перестал работать: создайте новый по шагу 5.',
      },
    },
  },
},
```

Englisch und Deutsch mit identischen Schlüsseln und sinngemäßer Übersetzung (Deutsch mit „Sie"). `{link:oauth}` bleibt in allen Sprachen stehen.

- [ ] **Step 4: Stil an `src/index.css` anhängen**

```css
/* Services & login guide */
.login-guide {
  padding: 18px 20px;
  border-radius: 18px;
  background: var(--card-bg);
  border: 1px solid var(--glass-line);
  color: var(--fg-2);
  font-size: 13px;
  line-height: 1.55;
}
.login-guide h3 { margin: 0 0 10px; font-family: var(--font-display); font-weight: 500; font-size: 15px; color: var(--fg); }
.login-guide h4 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
.login-guide ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.login-guide ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.login-guide-link { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
```

- [ ] **Step 5: Tests**

Run: `npx vitest run src/i18n`
Expected: PASS (Schlüsselgleichheit).

- [ ] **Step 6: Commit**

```bash
git add src/components/services src/i18n src/index.css electron/main.js
git commit -m "Dienste-Daten und Anleitung zur Anmeldung"
```

---

### Task 11: Yandex-Anmeldung, Anbieter-Auswahl, „Мои сервисы"

**Files:**
- Create: `src/components/services/YandexConnect.tsx`, `src/components/services/ProviderPicker.tsx`, `src/components/services/ServicesScreen.tsx`
- Delete: `src/components/TokenInput.tsx`
- Modify: `src/App.tsx`, `src/components/Dashboard.tsx`, `src/index.css`

- [ ] **Step 1: `YandexConnect.tsx`**

```tsx
import React, { useState } from 'react';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { connectProvider } from '../../services/hub';
import { cleanErrorMessage } from '../../utils/errors';
import { LoginGuide } from './LoginGuide';

export const YandexConnect: React.FC<{ onConnected: () => void }> = ({ onConnected }) => {
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await connectProvider('yandex', { token });
      onConnected();
    } catch (err) {
      setError(cleanErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="connect-layout">
      <form className="connect-form" onSubmit={submit}>
        <div className="connect-icon"><KeyRound className="w-7 h-7" /></div>
        <label htmlFor="yandex-token">{t('services.yandex.tokenLabel')}</label>
        <input id="yandex-token" value={token} onChange={e => setToken(e.target.value)} placeholder="y0_AgAAAA..." autoFocus />
        {error && <p className="connect-error">{error}</p>}
        <button type="submit" disabled={busy || !token.trim()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {t('services.yandex.connect')}
        </button>
      </form>
      <LoginGuide base="services.yandex.guide" stepCount={6} problemCount={2}
        links={{ oauth: 'https://oauth.yandex.ru/client/new/' }} />
    </div>
  );
};
```

- [ ] **Step 2: `ProviderPicker.tsx`**

```tsx
import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { PROVIDERS } from './providers';
import type { ProviderId } from '../../types/electron-api';

export const ProviderPicker: React.FC<{ connected: ProviderId[]; onPick: (id: ProviderId) => void }> = ({ connected, onPick }) => {
  const { t } = useI18n();
  return (
    <div className="provider-grid">
      {PROVIDERS.map(p => {
        const disabled = !p.available || connected.includes(p.id);
        return (
          <button key={p.id} className="provider-tile" disabled={disabled} onClick={() => onPick(p.id)}>
            <span className="provider-logo" style={{ background: p.color }}>{p.badge}</span>
            <span className="provider-name">{t(`services.names.${p.id}`)}</span>
            {!p.available && <span className="provider-soon">{t('services.soon')}</span>}
            {p.available && connected.includes(p.id) && <span className="provider-soon">{t('services.status.connected')}</span>}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 3: `ServicesScreen.tsx`**

```tsx
import React, { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { disconnectProvider } from '../../services/hub';
import type { AccountSummary, ProviderId } from '../../types/electron-api';
import { ProviderPicker } from './ProviderPicker';
import { YandexConnect } from './YandexConnect';
import { providerInfo } from './providers';

interface ServicesScreenProps {
  accounts: AccountSummary[];
  onChanged: () => void;
  /** Нет, если ни одного сервиса ещё нет (кнопка «назад» скрыта). */
  onClose?: () => void;
}

type View = { kind: 'list' } | { kind: 'pick' } | { kind: 'connect'; providerId: ProviderId };

export const ServicesScreen: React.FC<ServicesScreenProps> = ({ accounts, onChanged, onClose }) => {
  const { t } = useI18n();
  const [view, setView] = useState<View>(accounts.length === 0 ? { kind: 'pick' } : { kind: 'list' });

  const disconnect = async (providerId: ProviderId) => {
    if (!window.confirm(t('services.disconnectConfirm', { name: t(`services.names.${providerId}`) }))) return;
    await disconnectProvider(providerId);
    onChanged();
  };

  const back = () => (view.kind === 'list' ? onClose?.() : setView(accounts.length ? { kind: 'list' } : { kind: 'pick' }));
  const showBack = view.kind !== 'list' ? accounts.length > 0 || view.kind === 'connect' : Boolean(onClose);

  return (
    <div className="services-screen">
      <header className="services-header">
        {showBack && <button className="header-btn" onClick={back}><ArrowLeft className="w-4 h-4" /></button>}
        <h1>{view.kind === 'pick' ? t('services.choose') : view.kind === 'connect' ? t(`services.names.${view.providerId}`) : t('services.title')}</h1>
      </header>

      {view.kind === 'list' && (
        <>
          <div className="services-list">
            {accounts.map(account => {
              const info = providerInfo(account.providerId);
              return (
                <div key={account.providerId} className={`service-card is-${account.status}`}>
                  <span className="provider-logo" style={{ background: info.color }}>{info.badge}</span>
                  <div className="service-card-text">
                    <strong>{t(`services.names.${account.providerId}`)}</strong>
                    <span>{t(`services.status.${account.status}`)}</span>
                  </div>
                  {account.status === 'relogin' && (
                    <button onClick={() => setView({ kind: 'connect', providerId: account.providerId })}>{t('services.relogin')}</button>
                  )}
                  <button className="service-disconnect" onClick={() => disconnect(account.providerId)}>{t('services.disconnect')}</button>
                </div>
              );
            })}
          </div>
          <button className="services-add" onClick={() => setView({ kind: 'pick' })}>
            <Plus className="w-4 h-4" /> {t('services.add')}
          </button>
        </>
      )}

      {view.kind === 'pick' && (
        <>
          {accounts.length === 0 && <p className="services-empty">{t('services.empty')}</p>}
          <ProviderPicker connected={accounts.filter(a => a.status === 'connected').map(a => a.providerId)}
            onPick={providerId => setView({ kind: 'connect', providerId })} />
        </>
      )}

      {view.kind === 'connect' && view.providerId === 'yandex' && (
        <YandexConnect onConnected={() => { setView({ kind: 'list' }); onChanged(); }} />
      )}
    </div>
  );
};
```

- [ ] **Step 4: Einbinden**

- `src/App.tsx`: Der Rückgabezweig für `AppState.AUTH` rendert statt `<TokenInput …/>` jetzt `<ServicesScreen accounts={accounts} onChanged={loadData} />`. Im Dashboard-Zweig einen Zustand `const [showServices, setShowServices] = useState(false);`; ist er `true`, wird `<ServicesScreen accounts={accounts} onChanged={() => { setShowServices(false); loadData(); }} onClose={() => setShowServices(false)} />` statt `<Dashboard />` gerendert. `DashboardContext` bekommt `onOpenServices: () => setShowServices(true)` statt `onLogout`; den Typ in `src/contexts/DashboardContext.tsx` entsprechend ändern.
- `src/components/Dashboard.tsx`: Den „Выйти"-Knopf und das Bestätigungsfenster für den Logout entfernen. An seiner Stelle ein Knopf mit `Plug`-Icon (`lucide-react`), `title={t('services.title')}`, `onClick={ctx.onOpenServices}`.
- `git rm src/components/TokenInput.tsx`; Import in `App.tsx` entfernen.

- [ ] **Step 5: Stil an `src/index.css` anhängen**

```css
.services-screen { position: relative; z-index: 1; max-width: 980px; margin: 0 auto; padding: 34px; height: 100vh; overflow-y: auto; }
.services-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.services-header h1 { margin: 0; font-family: var(--font-display); font-weight: 500; font-size: 30px; letter-spacing: -0.03em; color: var(--fg); }
.services-empty { color: var(--muted); margin: 0 0 18px; }
.services-list { display: grid; gap: 12px; margin-bottom: 18px; }
.service-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 18px; background: var(--card-bg); border: 1px solid var(--glass-line); }
.service-card-text { flex: 1; display: flex; flex-direction: column; gap: 2px; color: var(--fg); }
.service-card-text span { font-size: 12px; color: var(--muted); }
.service-card.is-offline .service-card-text span, .service-card.is-relogin .service-card-text span { color: #E5484D; }
.service-card button, .services-add, .connect-form button {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--glass-line-strong);
  background: transparent; color: var(--fg); font: inherit; font-size: 13px; cursor: pointer;
}
.service-card button:hover, .services-add:hover { border-color: var(--accent); color: var(--accent); }
.service-disconnect { color: var(--muted) !important; }
.provider-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.provider-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 18px; border-radius: 20px; border: 1px solid var(--glass-line); background: var(--card-bg); color: var(--fg); font: inherit; cursor: pointer; text-align: left; transition: all var(--motion-fast) var(--ease-standard); }
.provider-tile:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-2px); }
.provider-tile:disabled { opacity: 0.5; cursor: default; }
.provider-logo { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; padding: 0 8px; border-radius: 12px; color: #fff; font-weight: 700; font-size: 13px; }
.provider-name { font-weight: 600; }
.provider-soon { font-size: 11px; color: var(--muted); }
.connect-layout { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(280px, 1.2fr); gap: 20px; align-items: start; }
@media (max-width: 760px) { .connect-layout { grid-template-columns: 1fr; } .connect-layout .login-guide { order: -1; } }
.connect-form { display: flex; flex-direction: column; gap: 10px; padding: 22px; border-radius: 20px; background: var(--card-bg); border: 1px solid var(--glass-line); color: var(--fg); }
.connect-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: var(--accent); color: var(--accent-on); margin-bottom: 6px; }
.connect-form label { font-size: 12px; color: var(--muted); }
.connect-form input { padding: 11px 14px; border-radius: 12px; border: 1px solid var(--glass-line-strong); background: var(--surface-warm); color: var(--fg); font: inherit; }
.connect-form input:focus { outline: none; border-color: var(--accent); }
.connect-form button { justify-content: center; background: var(--accent); color: var(--accent-on); border-color: transparent; }
.connect-form button:disabled { opacity: 0.5; }
.connect-error { margin: 0; font-size: 12.5px; color: #E5484D; }
```

- [ ] **Step 6: Build und Tests**

Run: `npm test && npm run build`
Expected: PASS, `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "Мои сервисы: Anbieter-Auswahl, Yandex-Anmeldung mit Anleitung"
```

---

### Task 12: Herkunftszeichen auf Karten

**Files:**
- Modify: `src/components/cards/DeviceCard.tsx`, `src/components/cards/ScenarioCard.tsx`, `src/index.css`

- [ ] **Step 1: Zeichen einbauen**

In beiden Karten importieren: `import { providerInfo } from '../services/providers';` und neben dem Namen rendern:

```tsx
<span className="provider-badge" title={t(`services.names.${providerInfo(device.provider_id).id}`)}>
  {providerInfo(device.provider_id).badge}
</span>
```

(`ScenarioCard` mit `scenario.provider_id`.) Laut Spezifikation immer sichtbar.

- [ ] **Step 2: Stil**

```css
.provider-badge {
  display: inline-flex; align-items: center; margin-left: 6px; padding: 1px 6px; border-radius: 6px;
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; vertical-align: middle;
  color: var(--muted); border: 1px solid var(--glass-line-strong);
}
.device-card.is-on .provider-badge { color: color-mix(in oklab, var(--card-fg-active) 60%, transparent); border-color: color-mix(in oklab, var(--card-fg-active) 20%, transparent); }
```

- [ ] **Step 3: Hinweis-Balken für ausgefallene Dienste**

In `src/components/Dashboard.tsx` direkt unter der `content-header`-Zeile einfügen (`accounts` kommt über `DashboardContext`; dort das Feld `accounts: AccountSummary[]` ergänzen und in `App.tsx` befüllen):

```tsx
{ctx.accounts.filter(a => a.status !== 'connected').map(a => (
  <button key={a.providerId} className="service-alert" onClick={ctx.onOpenServices}>
    {t('services.alert', { name: t(`services.names.${a.providerId}`), status: t(`services.status.${a.status}`) })}
  </button>
))}
```

Schlüssel in allen drei Sprachen: ru `alert: '{name}: {status}. Устройства этого сервиса сейчас не показаны.'`, en `alert: '{name}: {status}. Devices from this service are hidden for now.'`, de `alert: '{name}: {status}. Geräte dieses Dienstes werden gerade nicht angezeigt.'`.

```css
.service-alert { display: block; width: 100%; margin: -6px 0 18px; padding: 10px 14px; border-radius: 14px; border: 1px solid color-mix(in oklab, #E5484D 45%, transparent); background: color-mix(in oklab, #E5484D 10%, transparent); color: var(--fg); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
```

- [ ] **Step 4: Build, Commit**

Run: `npx vitest run src/i18n && npm run build` → PASS, `✓ built`.

```bash
git add src/components src/contexts src/App.tsx src/i18n src/index.css
git commit -m "Herkunftszeichen und Hinweis bei ausgefallenen Diensten"
```

---

### Task 13: Gesamtprüfung

- [ ] **Step 1:** `npm test && npm run build`, alles grün.
- [ ] **Step 2:** App bauen, signieren, installieren, starten (Maxim vorher fragen, ob er die App gerade nutzt).
- [ ] **Step 3:** Prüfen: Dashboard erscheint ohne neue Anmeldung; Plug-Knopf öffnet „Мои сервисы" mit Yandex als „подключено"; „Добавить сервис" zeigt Yandex (verbunden), Xiaomi und Aqara (скоро); Anleitung in DE/EN/RU sichtbar; Geräte schalten; Szenario starten; Tray-Favoriten funktionieren; Kamera öffnet.
- [ ] **Step 4:** Abmelden testen **nur mit Maxims ausdrücklicher Zustimmung** (danach muss er den Token neu eingeben).
- [ ] **Step 5:** `git push`.
