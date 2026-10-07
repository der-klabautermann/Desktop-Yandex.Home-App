import { useCallback } from 'react';
import { toggleDevice, toggleGroup, executeScenario, setDeviceMode, getCameraStream, setCameraPrivacyMode } from '../services/yandexIoT';
import { YandexUserInfoResponse, YandexModeAction, CameraStreamResult } from '../types/index';
import { cleanErrorMessage } from '../utils/errors';
import { useI18n } from '../i18n/I18nContext';

interface UseDeviceActionsReturn {
    handleToggleDevice: (deviceId: string, currentState: boolean) => Promise<void>;
    handleToggleGroup: (groupId: string, currentState: boolean) => Promise<void>;
    handleExecuteScenario: (scenarioId: string) => Promise<void>;
    handleSetDeviceMode: (deviceId: string, actions: YandexModeAction[], turnOn?: boolean) => Promise<void>;
    handleGetCameraStream: (deviceId: string) => Promise<CameraStreamResult>;
    handleSetCameraPrivacy: (deviceId: string, enabled: boolean, instance?: string) => Promise<void>;
}

export function useDeviceActions(
    token: string | null,
    userData: YandexUserInfoResponse | null,
    showNotification: (message: string, type?: 'error' | 'success') => void,
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>,
    requestXTokenAuth: () => Promise<boolean>
): UseDeviceActionsReturn {
    const { t } = useI18n();
    const handleToggleDevice = useCallback(async (deviceId: string, currentState: boolean) => {
        if (!token || !userData) return;
        const newState = !currentState;
        try {
            await toggleDevice(token, deviceId, newState);
            // Оптимистичное обновление делает setUserData, но у нас нет доступа к setUserData здесь
            // Пока оставим refreshDashboardData
            refreshDashboardData(token);
        } catch (err) {
            showNotification(t('errors.withDetail', { detail: cleanErrorMessage(err, t) }), 'error');
            throw err;
        }
    }, [token, userData, refreshDashboardData, showNotification, t]);

    const handleToggleGroup = useCallback(async (groupId: string, currentState: boolean) => {
        if (!token || !userData) return;
        const newState = !currentState;
        const group = userData.groups.find(g => g.id === groupId);
        const deviceIds = group?.devices || [];
        try {
            await toggleGroup(token, groupId, deviceIds, newState);
            refreshDashboardData(token);
            showNotification(t('actions.groupToggled'), 'success');
        } catch (err) {
            showNotification(t('errors.withDetail', { detail: cleanErrorMessage(err, t) }), 'error');
            throw err;
        }
    }, [token, userData, refreshDashboardData, showNotification, t]);

    const handleExecuteScenario = useCallback(async (scenarioId: string) => {
        if (!token) return;
        try {
            await executeScenario(token, scenarioId);
            showNotification(t('actions.scenarioStarted'), 'success');
            refreshDashboardData(token);
        } catch (err) {
            showNotification(t('errors.withDetail', { detail: cleanErrorMessage(err, t) }), 'error');
            throw err;
        }
    }, [token, refreshDashboardData, showNotification, t]);

    const handleSetDeviceMode = useCallback(async (deviceId: string, modeActions: YandexModeAction[], turnOn: boolean = false) => {
        if (!token) return;
        try {
            await setDeviceMode(token, deviceId, modeActions, turnOn);
            showNotification(t('actions.settingsApplied'), 'success');
            refreshDashboardData(token);
        } catch (err) {
            showNotification(t('errors.withDetail', { detail: cleanErrorMessage(err, t) }), 'error');
            throw err;
        }
    }, [token, refreshDashboardData, showNotification, t]);

    const handleGetCameraStream = useCallback(async (deviceId: string) => {
        const isXTokenError = (message: string) =>
            message.includes('X_TOKEN_REQUIRED')
            || message.includes('Quasar auth')
            || message.includes('x-token');
        try {
            return await getCameraStream(deviceId);
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (isXTokenError(message)) {
                const authenticated = await requestXTokenAuth();
                if (authenticated) {
                    return getCameraStream(deviceId);
                }
                throw new Error('X_TOKEN_REQUIRED');
            }
            throw err;
        }
    }, [requestXTokenAuth]);

    const handleSetCameraPrivacy = useCallback(async (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => {
        await setCameraPrivacyMode(deviceId, privacyEnabled, toggleInstance);
    }, []);

    return {
        handleToggleDevice, handleToggleGroup, handleExecuteScenario,
        handleSetDeviceMode, handleGetCameraStream, handleSetCameraPrivacy,
    };
}
