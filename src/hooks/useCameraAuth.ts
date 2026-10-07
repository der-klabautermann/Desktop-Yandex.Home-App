import { useState, useCallback, useRef } from 'react';
import { YandexUserInfoResponse } from '../types/index';
import { isCameraDevice } from '../constants';
import { useI18n } from '../i18n/I18nContext';

const yandexApi = window.api;

interface UseCameraAuthReturn {
    showQrAuth: boolean;
    promptXTokenIfNeeded: (data: YandexUserInfoResponse) => Promise<void>;
    requestXTokenAuth: () => Promise<boolean>;
    handleQrAuthSuccess: () => void;
    handleQrAuthClose: () => void;
}

export function useCameraAuth(showNotification: (message: string, type?: 'error' | 'success') => void): UseCameraAuthReturn {
    const { t } = useI18n();
    const [showQrAuth, setShowQrAuth] = useState(false);
    const qrAuthPromiseRef = useRef<{ resolve: (value: boolean) => void } | null>(null);

    const promptXTokenIfNeeded = useCallback(async (data: YandexUserInfoResponse) => {
        const hasCameras = data.devices.some(isCameraDevice);
        if (!hasCameras) return;
        const hasXToken = await yandexApi.hasXToken();
        if (!hasXToken) {
            setShowQrAuth(true);
        }
    }, []);

    const requestXTokenAuth = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            qrAuthPromiseRef.current = { resolve };
            setShowQrAuth(true);
        });
    }, []);

    const handleQrAuthSuccess = useCallback(() => {
        setShowQrAuth(false);
        qrAuthPromiseRef.current?.resolve(true);
        qrAuthPromiseRef.current = null;
        showNotification(t('camera.qr.success'), 'success');
    }, [showNotification, t]);

    const handleQrAuthClose = useCallback(() => {
        setShowQrAuth(false);
        qrAuthPromiseRef.current?.resolve(false);
        qrAuthPromiseRef.current = null;
    }, []);

    return { showQrAuth, promptXTokenIfNeeded, requestXTokenAuth, handleQrAuthSuccess, handleQrAuthClose };
}
