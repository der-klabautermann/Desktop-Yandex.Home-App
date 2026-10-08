import { describe, expect, it, vi } from 'vitest';
import { AQARA_ACCOUNT, createAqaraProvider } from './index';
import type { CredentialStore } from '../../provider';

const memoryStore = (initial: Record<string, string> = {}): CredentialStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async key => data.get(key) ?? null,
    set: async (key, value) => { data.set(key, value); },
    delete: async key => { data.delete(key); },
  };
};

const keys = { region: 'europe', appId: 'a', keyId: 'K.1', appKey: 'k', account: 'papa@example.com' };
const stored = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  ...keys, accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3_600_000, ...overrides,
});

describe('Aqara-Provider', () => {
  it('Anmeldung in zwei Schritten speichert die Zugangsdaten', async () => {
    const call = vi.fn(async (intent: string) => (intent === 'config.auth.getToken'
      ? { accessToken: 'tok', refreshToken: 'ref', expiresIn: '604800' } : {}));
    const store = memoryStore();
    const provider = createAqaraProvider(store, () => ({ call }) as any);

    await provider.connect({ ...keys, step: 'requestCode' });
    expect(call).toHaveBeenCalledWith('config.auth.getAuthCode', { account: 'papa@example.com', accountType: 0, accessTokenValidity: '1y' });
    expect(await provider.isConfigured()).toBe(false);

    await provider.connect({ ...keys, step: 'verify', code: ' 123456 ' });
    expect(call).toHaveBeenCalledWith('config.auth.getToken', { authCode: '123456', account: 'papa@example.com', accountType: 0 });
    expect(JSON.parse(store.data.get(AQARA_ACCOUNT)!).accessToken).toBe('tok');
    expect(await provider.isConfigured()).toBe(true);
  });

  it('fehlende Schlüssel werden abgelehnt', async () => {
    const provider = createAqaraProvider(memoryStore(), () => ({ call: vi.fn() }) as any);
    await expect(provider.connect({ ...keys, appKey: '', step: 'requestCode' })).rejects.toThrow('ERR_AQARA_INPUT');
  });

  it('erneuert einen abgelaufenen Token vor dem Aufruf', async () => {
    const call = vi.fn(async (intent: string) => (intent === 'config.auth.refreshToken'
      ? { accessToken: 'neu', refreshToken: 'ref2', expiresIn: '604800' } : undefined));
    const store = memoryStore({ [AQARA_ACCOUNT]: stored({ expiresAt: Date.now() - 1000 }) });
    await createAqaraProvider(store, () => ({ call }) as any).runScenario('AL.1');
    expect(call).toHaveBeenNthCalledWith(1, 'config.auth.refreshToken', { refreshToken: 'ref' });
    expect(call).toHaveBeenNthCalledWith(2, 'config.scene.run', { sceneId: 'AL.1' }, 'neu');
    expect(JSON.parse(store.data.get(AQARA_ACCOUNT)!).refreshToken).toBe('ref2');
  });

  it('wiederholt einmal nach ERR_TOKEN_EXPIRED', async () => {
    let first = true;
    const call = vi.fn(async (intent: string) => {
      if (intent === 'config.auth.refreshToken') return { accessToken: 'neu', refreshToken: 'ref2', expiresIn: '1' };
      if (first) { first = false; throw new Error('ERR_TOKEN_EXPIRED'); }
      return undefined;
    });
    const store = memoryStore({ [AQARA_ACCOUNT]: stored() });
    await createAqaraProvider(store, () => ({ call }) as any).toggleDevice('lumi.sw2#4.2.85', true);
    expect(call).toHaveBeenLastCalledWith('write.resource.device', [{ subjectId: 'lumi.sw2', resources: [{ resourceId: '4.2.85', value: '1' }] }], 'neu');
  });

  it('lädt Positionen, Geräte, Werte und Szenen', async () => {
    const call = vi.fn(async (intent: string, data: any) => {
      switch (intent) {
        case 'query.position.info':
          return data.parentPositionId === ''
            ? { data: [{ positionId: 'p.home', positionName: 'Дом' }], totalCount: 1 }
            : data.parentPositionId === 'p.home'
              ? { data: [{ positionId: 'p.kitchen', positionName: 'Кухня', parentPositionId: 'p.home' }], totalCount: 1 }
              : { data: [], totalCount: 0 };
        case 'query.device.info':
          return { data: [{ did: 'lumi.plug1', deviceName: 'Розетка', model: 'lumi.plug.maeu01', positionId: 'p.kitchen', state: 1, modelType: 3 }], totalCount: 1 };
        case 'query.resource.value':
          return [{ subjectId: 'lumi.plug1', resourceId: '4.1.85', value: '1' }];
        case 'query.scene.listByPositionId':
          return { data: [{ sceneId: 'AL.1', name: 'Ночь' }], totalCount: 1 };
        default:
          return undefined;
      }
    });
    const home = await createAqaraProvider(memoryStore({ [AQARA_ACCOUNT]: stored() }), () => ({ call }) as any).loadHome({ retry: false });
    expect(home.rooms.map(r => r.name)).toEqual(['Кухня']);
    expect(home.devices[0].id).toBe('aqara:lumi.plug1');
    expect(home.devices[0].room).toBe('aqara:p.kitchen');
    expect(home.scenarios[0].id).toBe('aqara:AL.1');
  });

  it('ohne gespeicherte Anmeldung ist ERR_AUTH', async () => {
    await expect(createAqaraProvider(memoryStore()).loadHome({ retry: false })).rejects.toThrow('ERR_AUTH');
  });
});
