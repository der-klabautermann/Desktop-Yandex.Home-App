import type { HomeData, ModeAction, ProviderId } from './model';

/** Хранилище секретов (на компьютере: связка ключей через keytar). */
export interface CredentialStore {
  get(account: string): Promise<string | null>;
  set(account: string, value: string): Promise<void>;
  delete(account: string): Promise<void>;
}

/** Последнее успешно загруженное состояние каждого сервиса (на компьютере: файл). */
export interface HomeCache {
  load(providerId: ProviderId): Promise<HomeData | null>;
  save(providerId: ProviderId, data: HomeData): Promise<void>;
  remove(providerId: ProviderId): Promise<void>;
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
