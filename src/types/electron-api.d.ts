// electron-api.d.ts
import { YandexUserInfoResponse, YandexDevice, TrayMenuItem, YandexModeAction, CameraStreamResult } from './index'; 

export interface YandexApiRequestOptions {
    retry?: boolean;
}

export type ProviderId = 'yandex' | 'xiaomi' | 'aqara' | 'homeassistant';

export interface AccountSummary {
    providerId: ProviderId;
    status: 'connected' | 'offline' | 'relogin';
    error?: string;
}

export interface HubLoadResult {
    data: YandexUserInfoResponse;
    accounts: AccountSummary[];
}

export interface IHubApi {
    accounts: () => Promise<AccountSummary[]>;
    connect: (providerId: ProviderId, payload: Record<string, string>) => Promise<void>;
    disconnect: (providerId: ProviderId) => Promise<void>;
    loadHome: (options?: YandexApiRequestOptions) => Promise<HubLoadResult>;
    toggleDevice: (deviceId: string, newState: boolean) => Promise<void>;
    setDeviceMode: (deviceId: string, actions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    toggleGroup: (groupId: string, deviceIds: string[], newState: boolean) => Promise<void>;
    runScenario: (scenarioId: string) => Promise<void>;
}

export interface IZonesApi {
    load: () => Promise<import('../../core/zones').ZoneConfig | null>;
    save: (config: import('../../core/zones').ZoneConfig) => Promise<void>;
}

export interface IYandexApi {
    hub: IHubApi;
    zones: IZonesApi;
    setLanguage?: (lang: 'de' | 'en' | 'ru') => void;
    getCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    setCameraPrivacyMode: (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => Promise<void>;
    getQuasarCameraDevice: (deviceId: string, options?: YandexApiRequestOptions) => Promise<YandexDevice>;

    hasXToken: () => Promise<boolean>;
    startQrAuth: () => Promise<{ qrUrl: string; qrDataUrl: string }>;
    pollQrAuth: () => Promise<
      | { status: 'pending' }
      | { status: 'ok'; xToken: string; displayLogin?: string }
      | { status: 'error'; message: string }
    >;
    cancelQrAuth: () => Promise<void>;

    isAutostartEnabled: () => Promise<boolean>;
    setAutostartEnabled: (enabled: boolean) => Promise<boolean>;

    sendFavoritesToTray: (favorites: TrayMenuItem[]) => void;
    onTrayCommand: (callback: (command: string, id: string, currentState?: boolean) => void) => void;
    removeTrayCommandListener: () => void;
    
    onRetryAttempt: (callback: (data: {action: string, attempt: number, maxAttempts: number, message: string}) => void) => () => void;

    showSystemNotification?: (payload: { title: string; body: string }) => void;
    showCameraStreamErrorNotification: (payload: {
        deviceId: string;
        deviceName: string;
        message: string;
    }) => Promise<boolean>;
    onCameraStreamRetry: (callback: (data: { deviceId: string }) => void) => () => void;
}

declare global {
    interface Window {
        api: IYandexApi;
    }
}
