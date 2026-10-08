import { providerOf, stripPrefix } from './ids';
import { mergeHomes, ProviderHome } from './merge';
import type { AccountSummary, HomeData, HubLoadResult, ModeAction, ProviderId } from './model';
import type { HomeCache, Provider } from './provider';

/** Распределитель: собирает все подключённые сервисы и направляет команды. */
export class Hub {
  private lastStatus = new Map<ProviderId, AccountSummary>();
  /** Последнее удачное состояние в памяти, чтобы не читать файл при каждом сбое. */
  private lastHome = new Map<ProviderId, HomeData>();

  constructor(private readonly providers: Provider[], private readonly cache?: HomeCache) {}

  private provider(id: ProviderId): Provider {
    const provider = this.providers.find(p => p.id === id);
    if (!provider) throw new Error(`ERR_UNKNOWN_PROVIDER ${id}`);
    return provider;
  }

  private async configured(): Promise<Provider[]> {
    const flags = await Promise.all(this.providers.map(p => p.isConfigured()));
    return this.providers.filter((_, index) => flags[index]);
  }

  private async lastKnown(providerId: ProviderId): Promise<HomeData | null> {
    const inMemory = this.lastHome.get(providerId);
    if (inMemory) return inMemory;
    try {
      return (await this.cache?.load(providerId)) ?? null;
    } catch {
      return null;
    }
  }

  private async remember(providerId: ProviderId, data: HomeData) {
    this.lastHome.set(providerId, data);
    try {
      await this.cache?.save(providerId, data);
    } catch {
      // Без кэша просто не будет серых карточек после перезапуска
    }
  }

  async accounts(): Promise<AccountSummary[]> {
    return (await this.configured()).map(p => this.lastStatus.get(p.id) ?? { providerId: p.id, status: 'connected' });
  }

  async connect(providerId: ProviderId, payload: Record<string, string>): Promise<void> {
    await this.provider(providerId).connect(payload);
    this.lastStatus.set(providerId, { providerId, status: 'connected' });
  }

  async disconnect(providerId: ProviderId): Promise<void> {
    await this.provider(providerId).disconnect();
    this.lastStatus.delete(providerId);
    this.lastHome.delete(providerId);
    await this.cache?.remove(providerId).catch(() => {});
  }

  async loadHome(options: { retry: boolean }): Promise<HubLoadResult> {
    const active = await this.configured();
    const results = await Promise.allSettled(active.map(p => p.loadHome(options)));

    const homes: ProviderHome[] = [];
    const accounts: AccountSummary[] = [];
    let reachable = 0;
    let firstError: unknown;

    for (const [index, result] of results.entries()) {
      const providerId = active[index].id;
      if (result.status === 'fulfilled') {
        reachable += 1;
        homes.push({ providerId, data: result.value });
        accounts.push({ providerId, status: 'connected' });
        await this.remember(providerId, result.value);
      } else {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
        firstError ??= result.reason;
        accounts.push({ providerId, status: message === 'ERR_AUTH' ? 'relogin' : 'offline', error: message });
        // Сервис недоступен: показываем последнее известное состояние серым
        const cached = await this.lastKnown(providerId);
        if (cached) homes.push({ providerId, data: cached, unreachable: true });
      }
    }

    accounts.forEach(a => this.lastStatus.set(a.providerId, a));
    if (reachable === 0 && homes.length === 0 && firstError) throw firstError;
    return { data: mergeHomes(homes), accounts };
  }

  toggleDevice(deviceId: string, newState: boolean) {
    return this.provider(providerOf(deviceId)).toggleDevice(stripPrefix(deviceId), newState);
  }

  setDeviceMode(deviceId: string, actions: ModeAction[], turnOn: boolean) {
    return this.provider(providerOf(deviceId)).setDeviceMode(stripPrefix(deviceId), actions, turnOn);
  }

  toggleGroup(groupId: string, deviceIds: string[], newState: boolean) {
    return this.provider(providerOf(groupId)).toggleGroup(stripPrefix(groupId), deviceIds.map(stripPrefix), newState);
  }

  runScenario(scenarioId: string) {
    return this.provider(providerOf(scenarioId)).runScenario(stripPrefix(scenarioId));
  }
}
