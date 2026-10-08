// Клиент Aqara Open API v3 с ключом разработчика пользователя.
// Подпись по документации Aqara и официальному SDK (aqara-iot-py-sdk, MIT).
import { createHash } from 'crypto';

export type AqaraRegion = 'europe' | 'russia' | 'china' | 'usa' | 'korea';

export const AQARA_ENDPOINTS: Record<AqaraRegion, string> = {
  europe: 'https://open-ger.aqara.com',
  russia: 'https://open-ru.aqara.com',
  china: 'https://open-cn.aqara.com',
  usa: 'https://open-usa.aqara.com',
  korea: 'https://open-kr.aqara.com',
};

export interface AqaraKeys {
  appId: string;
  keyId: string;
  appKey: string;
}

/** MD5 от строки заголовков плюс App Key, всё в нижнем регистре. */
export const signRequest = (keys: AqaraKeys, nonce: string, time: string, accessToken?: string): string => {
  const parts = [
    ...(accessToken ? [`Accesstoken=${accessToken}`] : []),
    `Appid=${keys.appId}`,
    `Keyid=${keys.keyId}`,
    `Nonce=${nonce}`,
    `Time=${time}`,
  ];
  return createHash('md5').update((parts.join('&') + keys.appKey).toLowerCase(), 'utf8').digest('hex');
};

// Коды ошибок Aqara: токен истёк или неверен
const TOKEN_EXPIRED = new Set([108, 109, 804, 2004, 2005]);
const REFRESH_INVALID = new Set([2006, 2007]);

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class AqaraClient {
  constructor(
    private readonly region: AqaraRegion,
    private readonly keys: AqaraKeys,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  /** Вызывает «намерение» (intent) Open API и возвращает поле result. */
  async call<T = any>(intent: string, data: unknown, accessToken?: string): Promise<T> {
    const nonce = Math.random().toString().slice(2, 18).padEnd(16, '0');
    const time = String(Date.now());
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Appid: this.keys.appId,
      Keyid: this.keys.keyId,
      Nonce: nonce,
      Time: time,
      Sign: signRequest(this.keys, nonce, time, accessToken),
      Lang: 'en',
    };
    if (accessToken) headers.Accesstoken = accessToken;

    let response: Response;
    try {
      response = await this.fetchImpl(`${AQARA_ENDPOINTS[this.region]}/v3.0/open/api`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ intent, data }),
      });
    } catch {
      throw new Error('ERR_NETWORK');
    }
    if (!response.ok) throw new Error(`ERR_HTTP ${response.status}`);

    const body = await response.json() as { code?: number; message?: string; msgDetails?: string; result?: T };
    const code = body.code ?? -1;
    if (code === 0) return body.result as T;
    if (TOKEN_EXPIRED.has(code)) throw new Error('ERR_TOKEN_EXPIRED');
    if (REFRESH_INVALID.has(code)) throw new Error('ERR_AUTH');
    throw new Error(`ERR_AQARA ${code} ${body.message ?? body.msgDetails ?? ''}`.trim());
  }
}
