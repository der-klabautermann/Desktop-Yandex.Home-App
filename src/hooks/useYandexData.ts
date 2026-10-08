import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { loadHome } from '../services/hub';
import { YandexUserInfoResponse } from '../types/index';
import type { AccountSummary } from '../types/electron-api';
import { hasDeviceStateChanges, stableSortData } from '../utils/dataUtils';
import { useI18n } from '../i18n/I18nContext';

interface UseYandexDataReturn {
    userData: YandexUserInfoResponse | null;
    isRefreshing: boolean;
    refreshDashboardData: (silent?: boolean) => Promise<void>;
    userDataRef: React.MutableRefObject<YandexUserInfoResponse | null>;
    setUserData: React.Dispatch<React.SetStateAction<YandexUserInfoResponse | null>>;
}

/** Данные дома из всех подключённых сервисов и их обновление. */
export function useYandexData(
    showNotification: (message: string, type?: 'error' | 'success') => void,
    setAccounts: React.Dispatch<React.SetStateAction<AccountSummary[]>>,
): UseYandexDataReturn {
    const { t } = useI18n();
    const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const userDataRef = useRef(userData);
    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

    const refreshDashboardData = useCallback(async (silent: boolean = false) => {
        if (!silent) {
            setIsRefreshing(true);
        }
        try {
            const result = await loadHome({ retry: !silent });
            const sortedData = stableSortData(result.data);
            const hasChanges = hasDeviceStateChanges(userDataRef.current, sortedData);
            setUserData(sortedData);
            setAccounts(result.accounts);

            if (!silent) {
                const allReachable = result.accounts.every(a => a.status === 'connected');
                showNotification(allReachable ? t('auth.refreshed') : t('auth.refreshedPartly'), allReachable ? 'success' : 'error');
            } else if (hasChanges) {
                console.log('Device states synchronized from external changes');
            }
        } catch (err: unknown) {
            if (!silent) {
                showNotification(t('auth.refreshFailed'), 'error');
            } else {
                console.error('Silent sync error:', err);
            }
        } finally {
            if (!silent) {
                setIsRefreshing(false);
            }
        }
    }, [showNotification, setAccounts, t]);

    return { userData, isRefreshing, refreshDashboardData, userDataRef, setUserData };
}
