import { describe, expect, it, vi } from 'vitest';
import { Hub } from './hub';
import type { HomeCache, Provider } from './provider';
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

const memoryCache = (initial: Partial<Record<ProviderId, HomeData>> = {}): HomeCache & { data: Map<ProviderId, HomeData> } => {
  const data = new Map(Object.entries(initial) as Array<[ProviderId, HomeData]>);
  return {
    data,
    load: async id => data.get(id) ?? null,
    save: async (id, value) => { data.set(id, value); },
    remove: async id => { data.delete(id); },
  };
};

const failing = (message: string) => vi.fn(async () => { throw new Error(message); });

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

  it('ein ausgefallener Dienst ohne gespeicherten Stand bremst die anderen nicht', async () => {
    const hub = new Hub([fakeProvider('yandex'), fakeProvider('xiaomi', { loadHome: failing('ERR_NETWORK') })]);
    const result = await hub.loadHome({ retry: false });
    expect(result.data.devices.map(d => d.id)).toEqual(['d']);
    expect(result.accounts[1]).toEqual({ providerId: 'xiaomi', status: 'offline', error: 'ERR_NETWORK' });
  });

  it('zeigt einen ausgefallenen Dienst mit dem letzten Stand, als nicht erreichbar markiert', async () => {
    const xiaomiLoad = vi.fn()
      .mockResolvedValueOnce(home('xiaomi:', 'Дом'))
      .mockRejectedValueOnce(new Error('ERR_NETWORK'));
    const hub = new Hub([fakeProvider('yandex'), fakeProvider('xiaomi', { loadHome: xiaomiLoad })]);
    await hub.loadHome({ retry: false });
    const second = await hub.loadHome({ retry: false });
    const device = second.data.devices.find(d => d.id === 'xiaomi:d')!;
    expect(device.unreachable).toBe(true);
    expect(second.data.devices.find(d => d.id === 'd')!.unreachable).toBeUndefined();
  });

  it('nutzt den Festplatten-Stand nach einem Neustart', async () => {
    const cache = memoryCache({ xiaomi: home('xiaomi:', 'Дом') });
    const hub = new Hub([fakeProvider('yandex'), fakeProvider('xiaomi', { loadHome: failing('ERR_NETWORK') })], cache);
    const result = await hub.loadHome({ retry: false });
    expect(result.data.devices.find(d => d.id === 'xiaomi:d')!.unreachable).toBe(true);
  });

  it('speichert erfolgreiche Ladevorgänge', async () => {
    const cache = memoryCache();
    await new Hub([fakeProvider('yandex')], cache).loadHome({ retry: false });
    expect(cache.data.get('yandex')!.devices[0].id).toBe('d');
  });

  it('abgelaufene Anmeldung wird als relogin gemeldet', async () => {
    const hub = new Hub([fakeProvider('yandex', { loadHome: failing('ERR_AUTH') }), fakeProvider('xiaomi')]);
    const result = await hub.loadHome({ retry: false });
    expect(result.accounts[0].status).toBe('relogin');
  });

  it('wirft, wenn alle Dienste ausfallen und nichts gespeichert ist', async () => {
    const hub = new Hub([fakeProvider('yandex', { loadHome: failing('ERR_NETWORK') })]);
    await expect(hub.loadHome({ retry: false })).rejects.toThrow('ERR_NETWORK');
  });

  it('zeigt bei Totalausfall den gespeicherten Stand statt zu werfen', async () => {
    const cache = memoryCache({ yandex: home('', 'Дом') });
    const hub = new Hub([fakeProvider('yandex', { loadHome: failing('ERR_NETWORK') })], cache);
    const result = await hub.loadHome({ retry: false });
    expect(result.data.devices[0].unreachable).toBe(true);
    expect(result.accounts[0].status).toBe('offline');
  });

  it('nicht verbundene Dienste werden übersprungen', async () => {
    const hub = new Hub([fakeProvider('yandex'), fakeProvider('aqara', { isConfigured: vi.fn(async () => false) })]);
    const result = await hub.loadHome({ retry: false });
    expect(result.accounts.map(a => a.providerId)).toEqual(['yandex']);
  });

  it('trennen löscht den gespeicherten Stand', async () => {
    const cache = memoryCache({ yandex: home('', 'Дом') });
    await new Hub([fakeProvider('yandex')], cache).disconnect('yandex');
    expect(cache.data.has('yandex')).toBe(false);
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
