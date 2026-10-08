import { AqaraClient, type AqaraKeys, type AqaraRegion } from './api';
import { buildAqaraHome, modeActionsToResources, parseDeviceId, type AqaraDeviceInfo, type AqaraPosition, type AqaraResourceValue, type AqaraScene } from './translate';
import type { CredentialStore, Provider } from '../../provider';
import type { ModeAction } from '../../model';

export const AQARA_ACCOUNT = 'provider:aqara';

interface AqaraCredentials extends AqaraKeys {
  region: AqaraRegion;
  account: string;
  accessToken: string;
  refreshToken: string;
  /** Unix-время в миллисекундах */
  expiresAt: number;
}

type ClientFactory = (region: AqaraRegion, keys: AqaraKeys) => Pick<AqaraClient, 'call'>;

const REGIONS: AqaraRegion[] = ['europe', 'russia', 'china', 'usa', 'korea'];

const readKeys = (payload: Record<string, string>): { region: AqaraRegion; keys: AqaraKeys; account: string } => {
  const region = payload.region as AqaraRegion;
  const keys = { appId: (payload.appId ?? '').trim(), keyId: (payload.keyId ?? '').trim(), appKey: (payload.appKey ?? '').trim() };
  const account = (payload.account ?? '').trim();
  if (!REGIONS.includes(region) || !keys.appId || !keys.keyId || !keys.appKey || !account) throw new Error('ERR_AQARA_INPUT');
  return { region, keys, account };
};

/** Срок жизни токена в ответе Aqara приходит в секундах строкой. */
const tokenExpiry = (expiresIn: unknown) => Date.now() + (Number(expiresIn) || 7 * 24 * 3600) * 1000;

/**
 * Aqara через ключ разработчика пользователя.
 * Вход в два шага: payload.step = 'requestCode' (Aqara присылает код), затем 'verify' с кодом.
 */
export const createAqaraProvider = (
  store: CredentialStore,
  makeClient: ClientFactory = (region, keys) => new AqaraClient(region, keys),
): Provider => {
  const load = async (): Promise<AqaraCredentials> => {
    const raw = await store.get(AQARA_ACCOUNT);
    if (!raw) throw new Error('ERR_AUTH');
    try {
      return JSON.parse(raw) as AqaraCredentials;
    } catch {
      throw new Error('ERR_AUTH');
    }
  };

  const save = (credentials: AqaraCredentials) => store.set(AQARA_ACCOUNT, JSON.stringify(credentials));

  const refresh = async (credentials: AqaraCredentials): Promise<AqaraCredentials> => {
    const result = await makeClient(credentials.region, credentials)
      .call<{ accessToken: string; refreshToken: string; expiresIn: string }>('config.auth.refreshToken', { refreshToken: credentials.refreshToken });
    const next = { ...credentials, accessToken: result.accessToken, refreshToken: result.refreshToken, expiresAt: tokenExpiry(result.expiresIn) };
    await save(next);
    return next;
  };

  /** Вызов с действующим токеном; при истёкшем токене один раз обновляет его. */
  const call = async <T>(intent: string, data: unknown): Promise<T> => {
    let credentials = await load();
    if (credentials.expiresAt - 60_000 < Date.now()) credentials = await refresh(credentials);
    try {
      return await makeClient(credentials.region, credentials).call<T>(intent, data, credentials.accessToken);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'ERR_TOKEN_EXPIRED') throw error;
      credentials = await refresh(credentials);
      return makeClient(credentials.region, credentials).call<T>(intent, data, credentials.accessToken);
    }
  };

  /** Все страницы списочного запроса (pageNum/pageSize). */
  const allPages = async <T>(intent: string, data: Record<string, unknown>): Promise<T[]> => {
    const items: T[] = [];
    for (let pageNum = 1; pageNum <= 50; pageNum++) {
      const page = await call<{ data?: T[]; totalCount?: number }>(intent, { ...data, pageNum, pageSize: 50 });
      items.push(...(page?.data ?? []));
      if (!page?.data?.length || items.length >= (page.totalCount ?? 0)) break;
    }
    return items;
  };

  const positionsBelow = async (parentPositionId: string, depth = 0): Promise<AqaraPosition[]> => {
    if (depth > 4) return [];
    const level = await allPages<AqaraPosition>('query.position.info', { parentPositionId });
    const children = await Promise.all(level.map(p => positionsBelow(p.positionId, depth + 1)));
    return [...level.map(p => ({ ...p, parentPositionId: p.parentPositionId ?? parentPositionId })), ...children.flat()];
  };

  const write = (did: string, resources: Array<{ resourceId: string; value: string }>) =>
    call('write.resource.device', [{ subjectId: did, resources }]);

  return {
    id: 'aqara',

    async isConfigured() {
      return Boolean(await store.get(AQARA_ACCOUNT));
    },

    async connect(payload) {
      const { region, keys, account } = readKeys(payload);
      const client = makeClient(region, keys);
      if (payload.step === 'requestCode') {
        // Aqara отправит код на почту или телефон аккаунта, он действует 10 минут
        await client.call('config.auth.getAuthCode', { account, accountType: 0, accessTokenValidity: '1y' });
        return;
      }
      const code = (payload.code ?? '').trim();
      if (!code) throw new Error('ERR_AQARA_INPUT');
      const result = await client.call<{ accessToken: string; refreshToken: string; expiresIn: string }>(
        'config.auth.getToken', { authCode: code, account, accountType: 0 },
      );
      await save({ ...keys, region, account, accessToken: result.accessToken, refreshToken: result.refreshToken, expiresAt: tokenExpiry(result.expiresIn) });
    },

    async disconnect() {
      await store.delete(AQARA_ACCOUNT);
    },

    async loadHome() {
      const positions = await positionsBelow('');
      const devices = await allPages<AqaraDeviceInfo>('query.device.info', { dids: [], positionId: '' });

      const values: AqaraResourceValue[] = [];
      for (let i = 0; i < devices.length; i += 40) {
        const batch = devices.slice(i, i + 40).map(d => ({ subjectId: d.did, resourceIds: [] }));
        values.push(...(await call<AqaraResourceValue[]>('query.resource.value', { resources: batch }) ?? []));
      }

      const scenes: AqaraScene[] = [];
      for (const position of positions.filter(p => !p.parentPositionId)) {
        const found = await allPages<AqaraScene>('query.scene.listByPositionId', { positionId: position.positionId }).catch(() => []);
        scenes.push(...found);
      }
      return buildAqaraHome({ positions, devices, values, scenes });
    },

    async toggleDevice(deviceId, newState) {
      const { did, onOffResource } = parseDeviceId(deviceId);
      await write(did, [{ resourceId: onOffResource, value: newState ? '1' : '0' }]);
    },

    async setDeviceMode(deviceId, actions: ModeAction[], turnOn) {
      const { did, onOffResource } = parseDeviceId(deviceId);
      const resources = modeActionsToResources(actions, onOffResource, turnOn);
      if (resources.length > 0) await write(did, resources);
    },

    async toggleGroup(_groupId, deviceIds, newState) {
      // У Aqara нет групп в нашем смысле: переключаем каждое устройство
      for (const deviceId of deviceIds) {
        const { did, onOffResource } = parseDeviceId(deviceId);
        await write(did, [{ resourceId: onOffResource, value: newState ? '1' : '0' }]);
      }
    },

    async runScenario(scenarioId) {
      await call('config.scene.run', { sceneId: scenarioId });
    },
  };
};
