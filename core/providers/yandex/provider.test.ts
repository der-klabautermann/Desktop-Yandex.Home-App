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
