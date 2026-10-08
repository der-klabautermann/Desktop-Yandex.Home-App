// Подменяет window.api в браузере, чтобы интерфейс можно было смотреть без Electron.
// Варианты: ?mock=multi (два сервиса), ?mock=outage (второй сервис недоступен),
// ?mock=empty (ничего не подключено), без параметра только Яндекс.
import { createMockHome, createMockXiaomiHome } from './mockData';
import type { YandexUserInfoResponse } from '../types';

type MockProvider = 'yandex' | 'xiaomi';

export function installMockApi() {
  const mode = new URLSearchParams(location.search).get('mock') ?? 'single';
  const homes: Record<MockProvider, YandexUserInfoResponse> = { yandex: createMockHome(), xiaomi: createMockXiaomiHome() };
  const connected = new Set<MockProvider>(mode === 'empty' ? [] : mode === 'single' ? ['yandex'] : ['yandex', 'xiaomi']);
  const offline = new Set<MockProvider>(mode === 'outage' ? ['xiaomi'] : []);
  const delay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));

  const allDevices = () => [...homes.yandex.devices, ...homes.xiaomi.devices];
  const setOn = (id: string, value: boolean) => {
    const cap = allDevices().find(d => d.id === id)?.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    if (cap?.state) cap.state.value = value;
  };
  const accounts = () => [...connected].map(providerId => offline.has(providerId)
    ? { providerId, status: 'offline' as const, error: 'ERR_NETWORK' }
    : { providerId, status: 'connected' as const });

  // Упрощённое объединение: комната «Кухня» Xiaomi сливается с яндексовой
  const merged = (): YandexUserInfoResponse => {
    const y = structuredClone(homes.yandex);
    const tag = <T extends object>(items: T[], provider: MockProvider) =>
      items.map(item => ({ ...item, provider_id: provider, ...(offline.has(provider) ? { unreachable: true } : {}) }));
    const result: YandexUserInfoResponse = { ...y, households: [], rooms: [], groups: [], devices: [], scenarios: [] };
    if (connected.has('yandex')) {
      result.households.push(...tag(y.households, 'yandex'));
      result.rooms.push(...tag(y.rooms, 'yandex'));
      result.groups.push(...tag(y.groups, 'yandex'));
      result.devices.push(...tag(y.devices, 'yandex'));
      result.scenarios.push(...tag(y.scenarios, 'yandex'));
    }
    if (connected.has('xiaomi')) {
      const x = structuredClone(homes.xiaomi);
      const kitchen = result.rooms.find(r => r.name.toLowerCase() === 'кухня');
      for (const room of x.rooms) {
        if (kitchen && room.name.toLowerCase() === 'кухня') kitchen.devices.push(...room.devices);
        else result.rooms.push({ ...room, household_id: result.households[0]?.id ?? room.household_id, provider_id: 'xiaomi' });
      }
      result.devices.push(...tag(x.devices.map(d => ({
        ...d,
        room: d.room === 'xiaomi:kitchen' && kitchen ? kitchen.id : d.room,
        household_id: result.households[0]?.id ?? d.household_id,
      })), 'xiaomi'));
      result.scenarios.push(...tag(x.scenarios, 'xiaomi'));
      if (!result.households.length) result.households.push(...tag(x.households, 'xiaomi'));
    }
    return result;
  };

  (window as any).api = {
    setLanguage: () => {},
    hub: {
      accounts: async () => accounts(),
      connect: async (providerId: MockProvider, payload: Record<string, string>) => {
        await delay(600);
        if (!payload.token?.trim()) throw new Error('ERR_AUTH');
        connected.add(providerId);
      },
      disconnect: async (providerId: MockProvider) => { connected.delete(providerId); },
      loadHome: async () => {
        await delay();
        if (connected.size === 0) throw new Error('ERR_AUTH');
        return { data: merged(), accounts: accounts() };
      },
      toggleDevice: async (id: string, value: boolean) => { await delay(); setOn(id, value); },
      toggleGroup: async (_g: string, ids: string[], value: boolean) => { await delay(); ids.forEach(id => setOn(id, value)); },
      setDeviceMode: async () => { await delay(); },
      runScenario: async () => { await delay(); },
    },
    getCameraStream: async () => { throw new Error('CAM_NO_STREAM'); },
    setCameraPrivacyMode: async () => {},
    getQuasarCameraDevice: async () => null,
    hasXToken: async () => true,
    startQrAuth: async () => ({ qrDataUrl: '', qrUrl: '' }),
    pollQrAuth: async () => ({ status: 'pending' }),
    cancelQrAuth: async () => {},
    isAutostartEnabled: async () => false,
    setAutostartEnabled: async () => {},
    sendFavoritesToTray: () => {},
    onTrayCommand: () => {},
    removeTrayCommandListener: () => {},
    onRetryAttempt: () => () => {},
    showCameraStreamErrorNotification: async () => {},
    onCameraStreamRetry: () => () => {},
  };
}
