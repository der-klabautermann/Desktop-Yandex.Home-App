import { describe, expect, it, vi } from 'vitest';
import { AqaraClient, signRequest } from './api';

describe('signRequest', () => {
  // Erwartete Werte mit Python nach dem offiziellen Aqara-SDK (MIT) berechnet
  it('ohne Zugangstoken', () => {
    expect(signRequest({ appId: 'app1', keyId: 'K.1', appKey: 'secret' }, '123', '1700000000000')).toBe('e1892fa3fe4c90ded79693301b197a11');
  });
  it('mit Zugangstoken', () => {
    expect(signRequest({ appId: 'app1', keyId: 'K.1', appKey: 'secret' }, '123', '1700000000000', 'tok')).toBe('9b5fdca91669184f3af02b6745a3773d');
  });
});

describe('AqaraClient', () => {
  const keys = { appId: 'app1', keyId: 'K.1', appKey: 'secret' };

  it('schickt Absicht, Kopfzeilen und Region', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 0, result: { ok: true } })));
    const client = new AqaraClient('europe', keys, fetchMock as any);
    const result = await client.call('query.device.info', { pageNum: 1 }, 'tok');
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe('https://open-ger.aqara.com/v3.0/open/api');
    expect(JSON.parse(init.body)).toEqual({ intent: 'query.device.info', data: { pageNum: 1 } });
    expect(init.headers.Appid).toBe('app1');
    expect(init.headers.Accesstoken).toBe('tok');
    expect(init.headers.Sign).toMatch(/^[0-9a-f]{32}$/);
  });

  it('abgelaufener Token wird ERR_TOKEN_EXPIRED', async () => {
    const client = new AqaraClient('europe', keys, (async () => new Response(JSON.stringify({ code: 2005, message: 'expired' }))) as any);
    await expect(client.call('query.device.info', {}, 'tok')).rejects.toThrow('ERR_TOKEN_EXPIRED');
  });

  it('ungültiger Refresh-Token wird ERR_AUTH', async () => {
    const client = new AqaraClient('europe', keys, (async () => new Response(JSON.stringify({ code: 2007 }))) as any);
    await expect(client.call('config.auth.refreshToken', {}, undefined)).rejects.toThrow('ERR_AUTH');
  });

  it('Netzwerkfehler wird ERR_NETWORK', async () => {
    const client = new AqaraClient('europe', keys, (async () => { throw new TypeError('fetch failed'); }) as any);
    await expect(client.call('query.device.info', {}, 'tok')).rejects.toThrow('ERR_NETWORK');
  });

  it('andere Fehler behalten Code und Text', async () => {
    const client = new AqaraClient('europe', keys, (async () => new Response(JSON.stringify({ code: 302, message: 'Missing parameter' }))) as any);
    await expect(client.call('query.device.info', {}, 'tok')).rejects.toThrow('ERR_AQARA 302 Missing parameter');
  });
});
