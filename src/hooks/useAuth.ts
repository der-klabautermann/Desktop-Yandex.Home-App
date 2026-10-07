import type React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchUserInfo } from '../services/yandexIoT';
import { AppState, YandexUserInfoResponse } from '../types/index';
import { stableSortData } from '../utils/dataUtils';
import { cleanErrorMessage } from '../utils/errors';
import { useI18n } from '../i18n/I18nContext';

const yandexApi = window.api;

interface RetryInfo {
    action: string;
    attempt: number;
    maxAttempts: number;
    message: string;
}

interface UseAuthReturn {
    token: string | null;
    setToken: React.Dispatch<React.SetStateAction<string | null>>;
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    errorMsg: string | undefined;
    retryInfo: RetryInfo | null;
    loadData: (apiToken: string) => Promise<void>;
    handleLogout: () => Promise<void>;
    handleCancelRetry: () => Promise<void>;
    handleTokenSubmit: (newToken: string) => Promise<void>;
    setUserData: React.Dispatch<React.SetStateAction<YandexUserInfoResponse | null>>;
    setErrorMsg: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export function useAuth(): UseAuthReturn {
    const { t } = useI18n();
    const [token, setToken] = useState<string | null>(null);
    const [appState, setAppState] = useState<AppState>(AppState.LOADING);
    const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
    const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);
    const [userData, setUserData] = useState<YandexUserInfoResponse | null>(null);
    const appStateRef = useRef(appState);

    useEffect(() => {
        appStateRef.current = appState;
    }, [appState]);

    const loadData = useCallback(async (apiToken: string) => {
        setAppState(AppState.LOADING);
        setErrorMsg(undefined);
        setRetryInfo(null);
        try {
            const data = await fetchUserInfo(apiToken);
            const sortedData = stableSortData(data);
            setUserData(sortedData);
            setAppState(AppState.DASHBOARD);
            setRetryInfo(null);
            // promptXTokenIfNeeded будет вызываться из useYandexData
        } catch (err: unknown) {
            setErrorMsg(cleanErrorMessage(err, t));
            setAppState(AppState.AUTH);
            if (err instanceof Error && (err.message.includes('401') || err.message.includes('403'))) {
                await yandexApi.deleteSecureToken();
                setToken(null);
            }
        }
    }, []);

    const handleLogout = useCallback(async () => {
        await yandexApi.deleteSecureToken();
        setToken(null);
        setUserData(null);
        setAppState(AppState.AUTH);
        setErrorMsg(undefined);
    }, []);

    const handleCancelRetry = useCallback(async () => {
        await yandexApi.deleteSecureToken();
        setToken(null);
        setUserData(null);
        setRetryInfo(null);
        setAppState(AppState.AUTH);
        setErrorMsg(t('auth.cancelled'));
    }, []);

    const handleTokenSubmit = useCallback(async (newToken: string) => {
        setToken(newToken);
        await yandexApi.setSecureToken(newToken);
        await loadData(newToken);
    }, [loadData]);

    // Effect: listen for retry attempts
    useEffect(() => {
        if (!window.api?.onRetryAttempt) return;
        const unsubscribe = window.api.onRetryAttempt((data: RetryInfo) => {
            if (appStateRef.current !== AppState.LOADING) {
                return;
            }
            if (data.action !== 'fetchUserInfo') {
                return;
            }
            setRetryInfo(data);
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return {
        token, setToken, appState, setAppState, errorMsg, retryInfo,
        loadData, handleLogout, handleCancelRetry, handleTokenSubmit,
        setUserData, setErrorMsg,
    };
}
