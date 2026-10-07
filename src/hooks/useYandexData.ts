import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchUserInfo } from '../services/yandexIoT';
import { YandexUserInfoResponse, AppState } from '../types/index';
import { hasDeviceStateChanges, stableSortData } from '../utils/dataUtils';
import { useI18n } from '../i18n/I18nContext';

const yandexApi = window.api;

interface UseYandexDataReturn {
    userData: YandexUserInfoResponse | null;
    isRefreshing: boolean;
    refreshDashboardData: (apiToken: string, silent?: boolean) => Promise<void>;
    userDataRef: React.MutableRefObject<YandexUserInfoResponse | null>;
    setUserData: React.Dispatch<React.SetStateAction<YandexUserInfoResponse | null>>;
}

export function useYandexData(
    showNotification: (message: string, type?: 'error' | 'success') => void,
    token: string | null,
    appState: AppState,
    setAppState: React.Dispatch<React.SetStateAction<AppState>>,
    setToken: React.Dispatch<React.SetStateAction<string | null>>,
    promptXTokenIfNeeded: (data: YandexUserInfoResponse) => Promise<void>
): UseYandexDataReturn {
    const { t } = useI18n();
    const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const userDataRef = useRef(userData);
    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

    const refreshDashboardData = useCallback(async (apiToken: string, silent: boolean = false) => {
        if (!silent) {
            setIsRefreshing(true);
        }
        try {
            const data = await fetchUserInfo(apiToken, { retry: !silent });
            const sortedData = stableSortData(data);
            const hasChanges = hasDeviceStateChanges(userDataRef.current, sortedData);
            setUserData(sortedData);

            if (!silent) {
                showNotification(t('auth.refreshed'), 'success');
            } else if (hasChanges) {
                console.log('Device states synchronized from external changes');
            }
        } catch (err: unknown) {
            if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
                await yandexApi.deleteSecureToken();
                setToken(null);
                setUserData(null);
                setAppState(AppState.AUTH);
                showNotification(t('auth.sessionExpired'), 'error');
            } else if (!silent) {
                showNotification(t('auth.refreshFailed'), 'error');
            } else {
                console.error('Silent sync error:', err);
            }
        } finally {
            if (!silent) {
                setIsRefreshing(false);
            }
        }
    }, [showNotification, setToken, setAppState, t]);

    return { userData, isRefreshing, refreshDashboardData, userDataRef, setUserData };
}
