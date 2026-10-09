// Подменяет window.api в браузере, чтобы интерфейс можно было смотреть без Electron.
// Варианты: ?mock=multi (два сервиса), ?mock=outage (второй сервис недоступен),
// ?mock=empty (ничего не подключено), ?mock=all (дом-выставка со всеми типами устройств),
// без параметра только Яндекс.
import { createMockHome, createMockXiaomiHome } from './mockData';
import { createShowroomHome } from './mockShowroom';
import type { YandexUserInfoResponse } from '../types';

type MockProvider = 'yandex' | 'xiaomi' | 'aqara' | 'homeassistant';

export function installMockApi() {
  const mode = new URLSearchParams(location.search).get('mock') ?? 'single';
  const homes: Record<'yandex' | 'xiaomi', YandexUserInfoResponse> = { yandex: createMockHome(), xiaomi: createMockXiaomiHome() };
  const showroom = mode === 'all' ? createShowroomHome() : null;
  const connected = new Set<MockProvider>(
    mode === 'empty' ? [] : mode === 'single' ? ['yandex'] : showroom ? ['yandex', 'aqara', 'homeassistant'] : ['yandex', 'xiaomi'],
  );
  const offline = new Set<MockProvider>(mode === 'outage' ? ['xiaomi'] : []);
  const delay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));

  const allDevices = () => showroom ? showroom.devices : [...homes.yandex.devices, ...homes.xiaomi.devices];
  const setOn = (id: string, value: boolean) => {
    const cap = allDevices().find(d => d.id === id)?.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    if (cap?.state) cap.state.value = value;
  };
  // Настройки (яркость, температура, режим) применяются к устройству, чтобы предпросмотр их показывал
  const applyActions = (id: string, actions: Array<{ instance: string; value: any }>, turnOn: boolean) => {
    const device = allDevices().find(d => d.id === id);
    if (!device) return;
    for (const action of actions) {
      const target = device.capabilities.find(c =>
        (c.parameters as any)?.instance === action.instance || c.state?.instance === action.instance
        || (c.type === 'devices.capabilities.color_setting' && ['hsv', 'rgb', 'temperature_k'].includes(action.instance)));
      if (!target) continue;
      const numeric = typeof action.value === 'string' && action.value.trim() !== '' && !isNaN(Number(action.value));
      target.state = { instance: action.instance, value: numeric ? Number(action.value) : action.value };
    }
    if (turnOn) setOn(id, true);
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
        if (providerId === 'aqara') {
          if (!payload.appId?.trim()) throw new Error('ERR_AQARA_INPUT');
          if (payload.step === 'requestCode') return;
          if (payload.code?.trim() !== '123456') throw new Error('ERR_AQARA 2003 Auth code incorrect');
        } else if (!payload.token?.trim()) {
          throw new Error('ERR_AUTH');
        }
        connected.add(providerId);
      },
      disconnect: async (providerId: MockProvider) => { connected.delete(providerId); },
      loadHome: async () => {
        await delay();
        if (connected.size === 0) throw new Error('ERR_AUTH');
        return { data: showroom ? structuredClone(showroom) : merged(), accounts: accounts() };
      },
      toggleDevice: async (id: string, value: boolean) => { await delay(); setOn(id, value); },
      toggleGroup: async (_g: string, ids: string[], value: boolean) => { await delay(); ids.forEach(id => setOn(id, value)); },
      setDeviceMode: async (id: string, actions: Array<{ instance: string; value: any }>, turnOn?: boolean) => {
        await delay(); applyActions(id, actions, !!turnOn);
      },
      runScenario: async () => { await delay(); },
    },
    zones: {
      load: async () => {
        try { return JSON.parse(localStorage.getItem('mock_zones') ?? 'null'); } catch { return null; }
      },
      save: async (config: unknown) => { localStorage.setItem('mock_zones', JSON.stringify(config)); },
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
