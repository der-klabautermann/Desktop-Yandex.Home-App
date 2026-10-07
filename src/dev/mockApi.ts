// Подменяет window.api в браузере, чтобы интерфейс можно было смотреть без Electron.
import { createMockHome } from './mockData';

export function installMockApi() {
  const home = createMockHome();
  const setOn = (id: string, value: boolean) => {
    const device = home.devices.find(d => d.id === id);
    const cap = device?.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    if (cap?.state) cap.state.value = value;
  };
  const delay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));
  let token: string | null = 'mock-token';

  (window as any).api = {
    setLanguage: () => {},
    fetchUserInfo: async () => { await delay(); return structuredClone(home); },
    fetchDevice: async (_t: string, id: string) => structuredClone(home.devices.find(d => d.id === id)),
    executeScenario: async () => { await delay(); },
    toggleDevice: async (_t: string, id: string, value: boolean) => { await delay(); setOn(id, value); },
    toggleGroup: async (_t: string, _g: string, ids: string[], value: boolean) => { await delay(); ids.forEach(id => setOn(id, value)); },
    setDeviceMode: async () => { await delay(); },
    getCameraStream: async () => { throw new Error('CAM_NO_STREAM'); },
    setCameraPrivacyMode: async () => {},
    getQuasarCameraDevice: async () => null,
    hasXToken: async () => true,
    startQrAuth: async () => ({ qrDataUrl: '', qrUrl: '' }),
    pollQrAuth: async () => ({ status: 'pending' }),
    cancelQrAuth: async () => {},
    getSecureToken: async () => token,
    setSecureToken: async (value: string) => { token = value; },
    deleteSecureToken: async () => { token = null; },
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
