import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ServicesScreen } from './components/services/ServicesScreen';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';
import { QrAuthModal } from './components/modals/QrAuthModal';
import { listAccounts, loadHome } from './services/hub';
import { AppState, YandexUserInfoResponse, YandexDevice, YandexScenario, YandexGroup, TrayMenuItem, TrayItemType, YandexHousehold } from './types/index';
import { formatSensorValueForTray, TraySensorDisplayConfig } from './constants';
import { stableSortData } from './utils/dataUtils';
import { cleanErrorMessage } from './utils/errors';
import { NotificationToast } from './components/NotificationToast';
import { ThemeProvider } from './contexts/ThemeContext';
import DashboardContext from './contexts/DashboardContext';
import { useNotification, useAuth, useFavorites, useNavigation, useUpdateNotification,
         useCameraAuth, useYandexData, useDeviceActions, useHousehold, useAutostart } from './hooks';
import packageJson from '../package.json';
import { debugLog, debugWarn, refreshDebugFlags } from './utils/debugLog';
import { useI18n } from './i18n/I18nContext';

const yandexApi = window.api;

function App() {
    // --- Хуки (порядок важен для зависимостей) ---
    // 1. Нет зависимостей
    const { t } = useI18n();
    const { notification, showNotification, clearNotification } = useNotification();
    const { accounts, setAccounts, appState, setAppState, errorMsg, setErrorMsg, retryInfo } = useAuth();
    const { favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds, toggleFavorite } = useFavorites();
    const { activeSidebarView, activeRoomId, activeGroupId, onSelectHome, onSelectRoom, onSelectGroup } = useNavigation();
    const { showUpdateNotification, setShowUpdateNotification, updateInfo } = useUpdateNotification();
    const [showServices, setShowServices] = useState(false);

    // 2. Зависит от showNotification
    const cameraAuth = useCameraAuth(showNotification);
    const { showQrAuth, promptXTokenIfNeeded, requestXTokenAuth, handleQrAuthSuccess, handleQrAuthClose } = cameraAuth;

    // 3. Данные всех сервисов
    const yandexData = useYandexData(showNotification, setAccounts);
    const { userData, isRefreshing, refreshDashboardData, setUserData } = yandexData;

    // 4. Зависит от userData, refreshDashboardData, requestXTokenAuth
    const actions = useDeviceActions(userData, showNotification, refreshDashboardData, requestXTokenAuth);
    const { handleToggleDevice, handleToggleGroup, handleExecuteScenario,
            handleSetDeviceMode, handleGetCameraStream, handleSetCameraPrivacy } = actions;
    const household = useHousehold(userData, refreshDashboardData);
    const { activeHouseholdId, handleSwitchHousehold } = household;

    // 5. Зависит от showNotification
    const { isAutostartEnabled, handleToggleAutostart } = useAutostart(showNotification);

    // Track AppState transitions — blank UI with only CSS background often means LOADING
    // (bg-transparent) or AUTH after an unexpected re-init / session wipe.
    const prevAppStateRef = React.useRef(appState);
    useEffect(() => {
        if (prevAppStateRef.current !== appState) {
            debugLog('app', 'appState', prevAppStateRef.current, '→', appState, {
                accounts: accounts.length,
                hasUserData: Boolean(userData),
            });
            prevAppStateRef.current = appState;
        }
    }, [appState, accounts, userData]);

    // --- Загрузка данных всех сервисов ---

    // Номер загрузки: результат устаревшей (отменённой) загрузки игнорируем
    const loadSeqRef = useRef(0);

    const loadData = useCallback(async () => {
        const seq = ++loadSeqRef.current;
        debugLog('app', 'loadData start');
        setAppState(AppState.LOADING);
        setErrorMsg(undefined);
        try {
            const result = await loadHome();
            if (seq !== loadSeqRef.current) return;
            const sortedData = stableSortData(result.data);
            setUserData(sortedData);
            setAccounts(result.accounts);
            setAppState(AppState.DASHBOARD);
            if (result.accounts.some(a => a.providerId === 'yandex' && a.status === 'connected')) {
                await promptXTokenIfNeeded(sortedData);
            }
            debugLog('app', 'loadData ok', { devices: sortedData.devices?.length });
        } catch (err) {
            if (seq !== loadSeqRef.current) return;
            debugWarn('app', 'loadData failed', err);
            setErrorMsg(cleanErrorMessage(err, t));
            setAccounts(await listAccounts().catch(() => []));
            setAppState(AppState.AUTH);
        }
    }, [setUserData, setAppState, setErrorMsg, setAccounts, promptXTokenIfNeeded, t]);

    const loadDataRef = useRef(loadData);
    useEffect(() => {
        loadDataRef.current = loadData;
    }, [loadData]);

    // Отмена ожидания на экране загрузки: открываем «Мои сервисы», данные входа не трогаем
    const handleCancelRetry = useCallback(async () => {
        debugLog('app', 'cancel retry');
        loadSeqRef.current += 1;
        setAccounts(await listAccounts().catch(() => []));
        setAppState(AppState.AUTH);
    }, [setAccounts, setAppState]);

    // --- 1. Init-эффект: какие сервисы подключены ---
    // Intentionally empty deps: must run once. Re-running would set AppState.LOADING
    // and wipe the dashboard.
    useEffect(() => {
        refreshDebugFlags();
        debugLog('app', 'init: accounts');
        const start = async () => {
            setAppState(AppState.LOADING);
            const connected = await listAccounts().catch(() => []);
            setAccounts(connected);
            if (connected.length > 0) {
                await loadDataRef.current();
            } else {
                setErrorMsg(undefined);
                setAppState(AppState.AUTH);
            }
        };
        void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- 2. Вспомогательная функция для подготовки данных для трея ---
    const getTrayMenuItems = useCallback((
        data: YandexUserInfoResponse | null,
        favDevices: string[],
        favScenarios: string[],
        favGroups: string[],
        householdId: string | null
    ): TrayMenuItem[] => {
        if (!data) return [];

        // Load user's sensor display config from localStorage (same key pattern as useDashboardState)
        let sensorDisplayConfig: Record<string, TraySensorDisplayConfig> = {};
        try {
            const storageKey = householdId
                ? `dashboard:sensorDisplayConfig:household:${householdId}`
                : 'dashboard:sensorDisplayConfig';
            const stored = localStorage.getItem(storageKey);
            if (stored) sensorDisplayConfig = JSON.parse(stored);
        } catch { /* ignore */ }

        const deviceMap = new Map(data.devices.map(d => [d.id, d]));
        const scenarioMap = new Map(data.scenarios.map(s => [s.id, s]));

        // 1. Избранные устройства
        const favDeviceItems: TrayMenuItem[] = favDevices
            .map(id => deviceMap.get(id))
            .filter((d): d is YandexDevice => !!d)
            .map(device => {
                const onOffCapability = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
                const isToggleable = !!onOffCapability;

                // Check if this is a sensor, smart meter, air conditioner, or kettle device
                // These devices have temperature/humidity properties to display
                const deviceType = device.type.toLowerCase();
                const isSensorOrMeter = deviceType.includes('sensor') || deviceType.includes('smart_meter');
                const isClimateDevice = deviceType.includes('thermostat') || deviceType.includes('kettle');

                // Calculate sensor value for devices that have temperature/humidity properties
                let sensorValue: string | null = null;
                if ((isSensorOrMeter && !isToggleable) || isClimateDevice) {
                    const deviceConfig = sensorDisplayConfig[device.id] ?? null;
                    sensorValue = formatSensorValueForTray(device, deviceConfig, t);
                }

                return {
                    id: device.id,
                    name: device.name,
                    type: 'device' as TrayItemType,
                    isToggleable: isToggleable && !device.unreachable,
                    isOn: onOffCapability?.state?.value === true,
                    sensorValue: sensorValue,
                    unreachable: device.unreachable,
                };
            });

        // 2. Избранные группы
        const favGroupItems: TrayMenuItem[] = favGroups
            .map(id => data.groups.find(g => g.id === id))
            .filter((g): g is YandexGroup => !!g)
            .map(group => {
                const onOffCapability = group.capabilities.find(c => c.type === 'devices.capabilities.on_off');
                const isToggleable = !!onOffCapability;

                // Группа считается включённой, только если ВСЕ устройства с on_off capability включены
                const devicesWithOnOff = group.devices
                    .map(id => deviceMap.get(id))
                    .filter((d): d is YandexDevice =>
                        !!d && d.capabilities.some(c => c.type === 'devices.capabilities.on_off')
                    );
                const isGroupOn = isToggleable && devicesWithOnOff.length > 0 &&
                    devicesWithOnOff.every(d =>
                        d.capabilities.some(c =>
                            c.type === 'devices.capabilities.on_off' && c.state?.value === true
                        )
                    );

                return {
                    id: group.id,
                    name: group.name,
                    type: 'group' as TrayItemType,
                    isToggleable: isToggleable && !group.unreachable,
                    unreachable: group.unreachable,
                    isOn: isGroupOn,
                };
            });

        // 3. Избранные сценарии
        const favScenarioItems: TrayMenuItem[] = favScenarios
            .map(id => scenarioMap.get(id))
            .filter((s): s is YandexScenario => !!s)
            .map(scenario => ({
                id: scenario.id,
                name: scenario.name,
                type: 'scenario' as TrayItemType,
                unreachable: scenario.unreachable,
            }));

        return [...favDeviceItems, ...favGroupItems, ...favScenarioItems];
    }, [t]);

    // --- 3. Tray-эффект (отправка избранного в трей) ---
    useEffect(() => {
        if (appState === AppState.DASHBOARD && userData) {
            const trayItems = getTrayMenuItems(userData, favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds, activeHouseholdId);
            yandexApi.sendFavoritesToTray(trayItems);
        }
    }, [appState, userData, favoriteDeviceIds, favoriteScenarioIds, favoriteGroupIds, activeHouseholdId, getTrayMenuItems]);

    // --- 4. Tray-эффект (обработка команд из трея) ---
    useEffect(() => {
        yandexApi.onTrayCommand((command: string, id: string, currentState: boolean | undefined) => {
            if (command === 'TOGGLE_DEVICE' && typeof currentState === 'boolean') {
                handleToggleDevice(id, currentState).catch(() => {});
            } else if (command === 'TOGGLE_GROUP' && typeof currentState === 'boolean') {
                handleToggleGroup(id, currentState).catch(() => {});
            } else if (command === 'EXECUTE_SCENARIO') {
                handleExecuteScenario(id).catch(() => {});
            }
        });
        return () => { yandexApi.removeTrayCommandListener(); };
    }, [handleToggleDevice, handleToggleGroup, handleExecuteScenario]);

    // --- 5. Polling-эффект (автосинхронизация) ---
    useEffect(() => {
        if (appState !== AppState.DASHBOARD || accounts.length === 0) return;
        const POLLING_INTERVAL = 120000;
        const pollingInterval = setInterval(() => {
            refreshDashboardData(true).catch(err => {
                console.error('Polling sync error:', err);
            });
        }, POLLING_INTERVAL);
        return () => { clearInterval(pollingInterval); };
    }, [appState, accounts.length, refreshDashboardData]);

    // --- Рендеринг ---

    // Экран загрузки
    if (appState === AppState.LOADING) {
        return (
            <ThemeProvider>
                <div className="min-h-screen flex items-center justify-center bg-transparent">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-12 h-12 border-4 border-[color:var(--accent)] border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-white/70 animate-pulse">
                            {retryInfo ? t('app.retrying', { attempt: retryInfo.attempt, max: retryInfo.maxAttempts }) : t('app.loading')}
                        </p>
                        {retryInfo && (
                            <>
                                <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                                    {t('app.noConnection')}<br/>
                                    {t('app.attempt', { attempt: retryInfo.attempt, max: retryInfo.maxAttempts })}
                                </p>
                                <button
                                    onClick={handleCancelRetry}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-colors font-medium text-sm"
                                >
                                    {t('common.cancel')}
                                </button>
                            </>
                        )}
                    </div>
                    <NotificationToast notification={notification} onClose={clearNotification} />
                </div>
            </ThemeProvider>
        );
    }

    // Основная панель
    if (appState === AppState.DASHBOARD && userData) {
        return (
            <ThemeProvider>
                <DashboardContext.Provider value={{
                    data: userData,
                    households: userData.households as YandexHousehold[],
                    activeHouseholdId,
                    favoriteDeviceIds,
                    favoriteScenarioIds,
                    favoriteGroupIds,
                    onToggleDeviceFavorite: (id: string) => toggleFavorite('device', id),
                    onToggleScenarioFavorite: (id: string) => toggleFavorite('scenario', id),
                    onToggleGroupFavorite: (id: string) => toggleFavorite('group', id),
                    onToggleDevice: handleToggleDevice,
                    onToggleGroup: handleToggleGroup,
                    onExecuteScenario: handleExecuteScenario,
                    onSetDeviceMode: handleSetDeviceMode,
                    onGetCameraStream: handleGetCameraStream,
                    onSetCameraPrivacy: handleSetCameraPrivacy,
                    onRefresh: () => refreshDashboardData(),
                    accounts,
                    activeSidebarView,
                    activeRoomId,
                    activeGroupId,
                    onSelectHome,
                    onSelectRoom,
                    onSelectGroup,
                    isRefreshing,
                    isAutostartEnabled,
                    onToggleAutostart: handleToggleAutostart,
                    onSwitchHousehold: handleSwitchHousehold,
                    onOpenServices: () => setShowServices(true),
                }}>
                    {showServices ? (
                        <ServicesScreen
                            accounts={accounts}
                            onChanged={() => { setShowServices(false); void loadData(); }}
                            onClose={() => setShowServices(false)}
                        />
                    ) : (
                        <Dashboard />
                    )}
                </DashboardContext.Provider>
                {updateInfo && (
                    <UpdateNotificationModal
                        isOpen={showUpdateNotification}
                        onClose={() => setShowUpdateNotification(false)}
                        currentVersion={packageJson.version}
                        latestVersion={updateInfo.latestVersion}
                        releaseUrl={updateInfo.releaseUrl}
                        releaseDate={updateInfo.releaseDate}
                    />
                )}
                <QrAuthModal
                    isOpen={showQrAuth}
                    onClose={handleQrAuthClose}
                    onSuccess={handleQrAuthSuccess}
                />
                <NotificationToast notification={notification} onClose={clearNotification} />
            </ThemeProvider>
        );
    }

    // Экран авторизации (по умолчанию)
    return (
        <ThemeProvider>
            <ServicesScreen
                accounts={accounts}
                error={errorMsg}
                onChanged={() => { void loadData(); }}
                onRetry={accounts.length > 0 ? () => { void loadData(); } : undefined}
            />
            <NotificationToast notification={notification} onClose={clearNotification} />
        </ThemeProvider>
    );
}

export default App;
