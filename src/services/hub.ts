import type { YandexModeAction } from '../types/index';
import type { AccountSummary, HubLoadResult, ProviderId } from '../types/electron-api';

// Все обращения интерфейса к сервисам умного дома идут через распределитель (hub)
const hub = () => window.api.hub;

export const listAccounts = (): Promise<AccountSummary[]> => hub().accounts();
export const connectProvider = (providerId: ProviderId, payload: Record<string, string>) => hub().connect(providerId, payload);
export const disconnectProvider = (providerId: ProviderId) => hub().disconnect(providerId);
export const loadHome = (options?: { retry?: boolean }): Promise<HubLoadResult> => hub().loadHome(options);
export const toggleDevice = (deviceId: string, newState: boolean) => hub().toggleDevice(deviceId, newState);
export const setDeviceMode = (deviceId: string, actions: YandexModeAction[], turnOn = false) =>
    hub().setDeviceMode(deviceId, actions, turnOn);
export const toggleGroup = (groupId: string, deviceIds: string[], newState: boolean) =>
    hub().toggleGroup(groupId, deviceIds, newState);
export const runScenario = (scenarioId: string) => hub().runScenario(scenarioId);
