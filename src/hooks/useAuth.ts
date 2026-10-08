import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { AppState } from '../types/index';
import type { AccountSummary } from '../types/electron-api';

interface RetryInfo {
    action: string;
    attempt: number;
    maxAttempts: number;
    message: string;
}

interface UseAuthReturn {
    accounts: AccountSummary[];
    setAccounts: React.Dispatch<React.SetStateAction<AccountSummary[]>>;
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    errorMsg: string | undefined;
    setErrorMsg: React.Dispatch<React.SetStateAction<string | undefined>>;
    retryInfo: RetryInfo | null;
    setRetryInfo: React.Dispatch<React.SetStateAction<RetryInfo | null>>;
}

/**
 * Состояние сеанса: подключённые сервисы, экран приложения, ошибка входа
 * и сообщения о повторных попытках подключения.
 */
export function useAuth(): UseAuthReturn {
    const [accounts, setAccounts] = useState<AccountSummary[]>([]);
    const [appState, setAppState] = useState<AppState>(AppState.LOADING);
    const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
    const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);
    const appStateRef = useRef(appState);

    useEffect(() => {
        appStateRef.current = appState;
        if (appState !== AppState.LOADING) setRetryInfo(null);
    }, [appState]);

    // Повторные попытки показываем только на экране загрузки
    useEffect(() => {
        if (!window.api?.onRetryAttempt) return;
        const unsubscribe = window.api.onRetryAttempt((data: RetryInfo) => {
            if (appStateRef.current !== AppState.LOADING) return;
            if (data.action !== 'fetchUserInfo') return;
            setRetryInfo(data);
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return { accounts, setAccounts, appState, setAppState, errorMsg, setErrorMsg, retryInfo, setRetryInfo };
}
