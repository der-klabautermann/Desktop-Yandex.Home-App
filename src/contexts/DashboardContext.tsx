import type { PageView, SidebarView } from '../hooks/useNavigation';
import React, { createContext, useContext } from 'react';
import { YandexUserInfoResponse, YandexHousehold, YandexModeAction, CameraStreamResult } from '../types/index';
import type { AccountSummary } from '../types/electron-api';
import type { UseZonesReturn } from '../hooks/useZones';
import type { UseActivityReturn } from '../hooks/useActivity';
import type { UseAutomationsReturn } from '../hooks/useAutomations';

export interface DashboardContextValue {
    // Данные
    data: YandexUserInfoResponse;
    households: YandexHousehold[];
    activeHouseholdId: string | null;
    /** Подключённые сервисы и их состояние. */
    accounts: AccountSummary[];
    /** Зоны (этажи и комнаты) активного дома. */
    zones: UseZonesReturn;
    /** Расписания и собственные сценарии. */
    automations: UseAutomationsReturn;

    // Избранное
    favoriteDeviceIds: string[];
    favoriteScenarioIds: string[];
    favoriteGroupIds: string[];
    onToggleDeviceFavorite: (id: string) => void;
    onToggleScenarioFavorite: (id: string) => void;
    onToggleGroupFavorite: (id: string) => void;

    // Действия
    onToggleDevice: (id: string, currentState: boolean) => Promise<void>;
    onToggleGroup: (id: string, currentState: boolean) => Promise<void>;
    onExecuteScenario: (id: string) => Promise<void>;
    onSetDeviceMode: (deviceId: string, modeActions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    onGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    onSetCameraPrivacy: (deviceId: string, enabled: boolean, instance?: string) => Promise<void>;
    /** silent: без индикатора и сообщения (фоновый опрос). */
    onRefresh: (silent?: boolean) => void;
    /** Включить или выключить несколько устройств сразу. */
    onSetPower: (deviceIds: string[], on: boolean) => Promise<void>;

    // Навигация
    activeSidebarView: SidebarView;
    activeRoomId: string | null;
    activeGroupId: string | null;
    onSelectHome: () => void;
    onSelectRoom: (roomId: string) => void;
    onSelectGroup: (groupId: string) => void;
    activeDeviceId: string | null;
    onSelectDevice: (deviceId: string) => void;
    onBack: () => void;
    onSelectCameras: () => void;
    onSelectPage: (page: PageView) => void;
    /** Удаление устройства в его сервисе; список сервисов, где это возможно. */
    onDeleteDevice: (deviceId: string) => Promise<boolean>;
    deletableProviders: string[];

    // UI-состояния
    isRefreshing: boolean;
    isAutostartEnabled: boolean;
    onToggleAutostart: () => void;
    onSwitchHousehold: (householdId?: string) => void;
    onOpenServices: () => void;
    onOpenSettings: () => void;
    /** Открыть выбор нового сервиса («Новое подключение»). */
    onAddService: () => void;
    /** Лента уведомлений. */
    activity: UseActivityReturn;
    /** Настройки попросили включить режим редактирования панели. */
    editRequested: boolean;
    onEditHandled: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext(): DashboardContextValue {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboardContext must be used within DashboardContext.Provider');
    }
    return context;
}

export default DashboardContext;
