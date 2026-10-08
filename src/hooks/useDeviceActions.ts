import { useCallback } from 'react';
import { toggleDevice, toggleGroup, runScenario, setDeviceMode } from '../services/hub';
import { getCameraStream, setCameraPrivacyMode } from '../services/camera';
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

type Item = { unreachable?: boolean; provider_id?: string } | undefined;

export function useDeviceActions(
    userData: YandexUserInfoResponse | null,
    showNotification: (message: string, type?: 'error' | 'success') => void,
    refreshDashboardData: (silent?: boolean) => Promise<void>,
    requestXTokenAuth: () => Promise<boolean>
): UseDeviceActionsReturn {
    const { t } = useI18n();

    /** Сервис недоступен: ничего не отправляем, а коротко сообщаем «нет связи». */
    const blockedByOutage = useCallback((item: Item) => {
        if (!item?.unreachable) return false;
        const name = t(`services.names.${item.provider_id ?? 'yandex'}`);
        showNotification(t('services.unreachable', { name }), 'error');
        return true;
    }, [showNotification, t]);

    const fail = useCallback((err: unknown) => {
        showNotification(t('errors.withDetail', { detail: cleanErrorMessage(err, t) }), 'error');
    }, [showNotification, t]);

    const handleToggleDevice = useCallback(async (deviceId: string, currentState: boolean) => {
        if (!userData) return;
        if (blockedByOutage(userData.devices.find(d => d.id === deviceId))) return;
        try {
            await toggleDevice(deviceId, !currentState);
            refreshDashboardData(true);
        } catch (err) {
            fail(err);
            throw err;
        }
    }, [userData, refreshDashboardData, blockedByOutage, fail]);

    const handleToggleGroup = useCallback(async (groupId: string, currentState: boolean) => {
        if (!userData) return;
        const group = userData.groups.find(g => g.id === groupId);
        if (blockedByOutage(group)) return;
        try {
            await toggleGroup(groupId, group?.devices || [], !currentState);
            refreshDashboardData(true);
            showNotification(t('actions.groupToggled'), 'success');
        } catch (err) {
            fail(err);
            throw err;
        }
    }, [userData, refreshDashboardData, showNotification, blockedByOutage, fail, t]);

    const handleExecuteScenario = useCallback(async (scenarioId: string) => {
        if (blockedByOutage(userData?.scenarios.find(s => s.id === scenarioId))) return;
        try {
            await runScenario(scenarioId);
            showNotification(t('actions.scenarioStarted'), 'success');
            refreshDashboardData(true);
        } catch (err) {
            fail(err);
            throw err;
        }
    }, [userData, refreshDashboardData, showNotification, blockedByOutage, fail, t]);

    const handleSetDeviceMode = useCallback(async (deviceId: string, modeActions: YandexModeAction[], turnOn: boolean = false) => {
        if (blockedByOutage(userData?.devices.find(d => d.id === deviceId))) return;
        try {
            await setDeviceMode(deviceId, modeActions, turnOn);
            showNotification(t('actions.settingsApplied'), 'success');
            refreshDashboardData(true);
        } catch (err) {
            fail(err);
            throw err;
        }
    }, [userData, refreshDashboardData, showNotification, blockedByOutage, fail, t]);

    const handleGetCameraStream = useCallback(async (deviceId: string) => {
        if (userData?.devices.find(d => d.id === deviceId)?.unreachable) {
            throw new Error('ERR_UNREACHABLE');
        }
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
    }, [userData, requestXTokenAuth]);

    const handleSetCameraPrivacy = useCallback(async (deviceId: string, privacyEnabled: boolean, toggleInstance?: string) => {
        await setCameraPrivacyMode(deviceId, privacyEnabled, toggleInstance);
    }, []);

    return {
        handleToggleDevice, handleToggleGroup, handleExecuteScenario,
        handleSetDeviceMode, handleGetCameraStream, handleSetCameraPrivacy,
    };
}
