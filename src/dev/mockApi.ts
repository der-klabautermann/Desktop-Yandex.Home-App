// Подменяет window.api в браузере, чтобы интерфейс можно было смотреть без Electron.
// Варианты: ?mock=multi (два сервиса), ?mock=outage (второй сервис недоступен),
// ?mock=empty (ничего не подключено), ?mock=all (дом-выставка со всеми типами устройств),
// без параметра только Яндекс.
import { createMockHome, createMockXiaomiHome } from './mockData';
import { createShowroomHome } from './mockShowroom';
import { localizeShowroom } from './showroomNames';
import { IS_DEMO } from './demo';
import { branchesOf, runScenarioFlow } from '../../core/scenarios';
import { firedScenarios, snapshotOf, type HomeSnapshot } from '../../core/triggers';
import type { YandexUserInfoResponse } from '../types';

type MockProvider = 'yandex' | 'xiaomi' | 'aqara' | 'homeassistant';

export function installMockApi() {
  // В демо-сборке по умолчанию весь дом-выставка
  const mode = new URLSearchParams(location.search).get('mock') ?? (IS_DEMO ? 'all' : 'single');
  const homes: Record<'yandex' | 'xiaomi', YandexUserInfoResponse> = { yandex: createMockHome(), xiaomi: createMockXiaomiHome() };
  // Названия выставки на языке интерфейса (для снимков экрана)
  const showroom = mode === 'all' ? localizeShowroom(createShowroomHome(), localStorage.getItem('app_language') ?? 'de') : null;
  const connected = new Set<MockProvider>(
    mode === 'empty' ? [] : mode === 'single' ? ['yandex'] : showroom ? ['yandex', 'aqara', 'homeassistant'] : ['yandex', 'xiaomi'],
  );
  const offline = new Set<MockProvider>(mode === 'outage' ? ['xiaomi'] : []);
  const delay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));
  let pairingTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSnapshot: HomeSnapshot | null = null;

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
    // Платформу передаёт preload демо-приложения: на Mac нужен отступ под кнопки окна
    platform: (window as any).demoEnv?.platform,
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
        const data = showroom ? structuredClone(showroom) : merged();
        // Как главный процесс: новые события устройств запускают собственные сценарии
        const next = snapshotOf(data.devices);
        const saved = JSON.parse(localStorage.getItem('mock_schedules') ?? 'null');
        for (const id of firedScenarios(saved?.scenarios ?? [], lastSnapshot, next)) void (window as any).api.scenarios.run(id);
        lastSnapshot = next;
        return { data, accounts: accounts() };
      },
      toggleDevice: async (id: string, value: boolean) => { await delay(); setOn(id, value); },
      toggleGroup: async (_g: string, ids: string[], value: boolean) => { await delay(); ids.forEach(id => setOn(id, value)); },
      setDeviceMode: async (id: string, actions: Array<{ instance: string; value: any }>, turnOn?: boolean) => {
        await delay(); applyActions(id, actions, !!turnOn);
      },
      runScenario: async () => { await delay(); },
      deletableProviders: async () => ['yandex'],
      addOptions: async () => ({ yandex: 'external', aqara: 'pairing', homeassistant: 'external', xiaomi: 'external' }),
      pairingHubs: async () => [{ id: 'aqara:hub-m2', name: 'Aqara Hub M2', online: true }],
      // Через несколько секунд после включения сопряжения «находится» новый датчик
      startPairing: async () => {
        await delay();
        pairingTimer = setTimeout(() => {
          const home = showroom ?? homes.yandex;
          const room = home.rooms[0];
          const id = `aqara:new-${Date.now().toString(36)}`;
          home.devices.push({
            id, name: 'Neuer Türkontakt', type: 'devices.types.sensor.open', room: room?.id, household_id: room?.household_id,
            provider_id: 'aqara', capabilities: [],
            properties: [{ type: 'devices.properties.event', retrievable: true, reportable: true,
              parameters: { instance: 'open', events: [{ value: 'opened' }, { value: 'closed' }] }, state: { instance: 'open', value: 'closed' } }],
          } as any);
          room?.devices.push(id);
        }, 6000);
      },
      stopPairing: async () => { if (pairingTimer) clearTimeout(pairingTimer); },
      openAddDevice: async () => { await delay(); },
      deleteDevice: async (id: string) => {
        await delay();
        const home = showroom ?? homes.yandex;
        home.devices = home.devices.filter(d => d.id !== id);
        home.rooms.forEach(r => { r.devices = r.devices.filter(d => d !== id); });
        home.groups.forEach(g => { g.devices = g.devices.filter(d => d !== id); });
      },
    },
    zones: {
      load: async () => {
        try { return JSON.parse(localStorage.getItem('mock_zones') ?? 'null'); } catch { return null; }
      },
      save: async (config: unknown) => { localStorage.setItem('mock_zones', JSON.stringify(config)); },
    },
    schedules: {
      load: async () => {
        try { return JSON.parse(localStorage.getItem('mock_schedules') ?? 'null'); } catch { return null; }
      },
      save: async (config: unknown) => { localStorage.setItem('mock_schedules', JSON.stringify(config)); },
    },
    scenarios: {
      run: async (scenarioId: string) => {
        const saved = JSON.parse(localStorage.getItem('mock_schedules') ?? 'null');
        const scenario = saved?.scenarios?.find((s: { id: string }) => s.id === scenarioId);
        if (!scenario) throw new Error('ERR_UNKNOWN_SCENARIO');
        return runScenarioFlow((window as any).api.hub, branchesOf(scenario)).immediate;
      },
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
