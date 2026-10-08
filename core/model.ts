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
