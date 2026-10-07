import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

const yandexApi = window.api;

interface UseAutostartReturn {
    isAutostartEnabled: boolean;
    handleToggleAutostart: () => void;
}

export function useAutostart(
    showNotification: (message: string, type?: 'error' | 'success') => void
): UseAutostartReturn {
    const { t } = useI18n();
    const [isAutostartEnabled, setIsAutostartEnabled] = useState<boolean>(false);
    const autostartStateRef = useRef(isAutostartEnabled);

    // Load initial autostart state from OS
    useEffect(() => {
        yandexApi.isAutostartEnabled().then(setIsAutostartEnabled).catch(console.error);
    }, []);

    useEffect(() => {
        autostartStateRef.current = isAutostartEnabled;
    }, [isAutostartEnabled]);

    const handleToggleAutostart = useCallback(async () => {
        try {
            const newState = !autostartStateRef.current;
            await yandexApi.setAutostartEnabled(newState);
            setIsAutostartEnabled(newState);
            showNotification(
                newState
                    ? t('auth.autostartOn')
                    : t('auth.autostartOff'),
                'success'
            );
        } catch (error) {
            console.error('Ошибка при изменении автозапуска:', error);
            showNotification(t('auth.autostartFailed'), 'error');
        }
    }, [showNotification, t]);

    return { isAutostartEnabled, handleToggleAutostart };
}
