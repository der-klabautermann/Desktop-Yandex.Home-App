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
