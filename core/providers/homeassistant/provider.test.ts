import { describe, expect, it, vi } from 'vitest';
import { HOME_ASSISTANT_ACCOUNT, createHomeAssistantProvider, normalizeUrl } from './index';
import type { CredentialStore } from '../../provider';

const memoryStore = (initial: Record<string, string> = {}): CredentialStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return { data, get: async k => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); }, delete: async k => { data.delete(k); } };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Home-Assistant-Provider', () => {
  it('normalizeUrl ergänzt http und entfernt Schrägstriche', () => {
    expect(normalizeUrl(' homeassistant.local:8123/ ')).toBe('http://homeassistant.local:8123');
    expect(normalizeUrl('https://ha.example.org')).toBe('https://ha.example.org');
  });

  it('connect prüft Adresse und Token und speichert sie', async () => {
    const fetchMock = vi.fn(async () => json({ message: 'API running.' }));
    const store = memoryStore();
    await createHomeAssistantProvider(store, fetchMock).connect({ url: '192.168.1.5:8123', token: 'abc' });
    expect(fetchMock).toHaveBeenCalledWith('http://192.168.1.5:8123/api/', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer abc' }),
    }));
    expect(JSON.parse(store.data.get(HOME_ASSISTANT_ACCOUNT)!)).toEqual({ url: 'http://192.168.1.5:8123', token: 'abc' });
  });

  it('falscher Token ist ERR_AUTH, keine Verbindung ist ERR_NETWORK', async () => {
    await expect(createHomeAssistantProvider(memoryStore(), async () => json({}, 401)).connect({ url: 'x', token: 'y' })).rejects.toThrow('ERR_AUTH');
    await expect(createHomeAssistantProvider(memoryStore(), async () => { throw new TypeError('fetch failed'); }).connect({ url: 'x', token: 'y' })).rejects.toThrow('ERR_NETWORK');
    await expect(createHomeAssistantProvider(memoryStore(), vi.fn()).connect({ url: '', token: 'y' })).rejects.toThrow('ERR_HA_INPUT');
  });

  it('lädt Zuhause aus config, states und Vorlage', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/config')) return json({ location_name: 'Дача' });
      if (url.endsWith('/api/states')) return json([{ entity_id: 'switch.plug', state: 'on', attributes: { friendly_name: 'Plug' } }]);
      if (url.endsWith('/api/template')) return new Response('{"areas": [{"id": "k", "name": "Кухня"}], "entities": [{"e": "switch.plug", "a": "k", "d": null, "dn": null}]}');
      return json({}, 404);
    });
    const store = memoryStore({ [HOME_ASSISTANT_ACCOUNT]: JSON.stringify({ url: 'http://ha:8123', token: 't' }) });
    const home = await createHomeAssistantProvider(store, fetchMock).loadHome({ retry: false });
    expect(home.households[0].name).toBe('Дача');
    expect(home.devices[0].id).toBe('homeassistant:switch.plug');
    expect(home.rooms[0].devices).toEqual(['homeassistant:switch.plug']);
  });

  it('schaltet über den passenden Dienst', async () => {
    const fetchMock = vi.fn(async () => json([]));
    const store = memoryStore({ [HOME_ASSISTANT_ACCOUNT]: JSON.stringify({ url: 'http://ha:8123', token: 't' }) });
    await createHomeAssistantProvider(store, fetchMock).toggleDevice('light.ceiling', false);
    expect(fetchMock).toHaveBeenCalledWith('http://ha:8123/api/services/light/turn_off', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ entity_id: 'light.ceiling' }),
    }));
  });
});
