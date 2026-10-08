import { YandexDevice, CameraStreamResult } from '../types/index';

// Камеры пока есть только у Яндекса, поэтому вызовы идут напрямую, без распределителя
const yandexApi = window.api;

export const getCameraStream = (deviceId: string): Promise<CameraStreamResult> =>
    yandexApi.getCameraStream(deviceId);

export const setCameraPrivacyMode = (deviceId: string, privacyEnabled: boolean, toggleInstance = 'privacy'): Promise<void> =>
    yandexApi.setCameraPrivacyMode(deviceId, privacyEnabled, toggleInstance);

export const getQuasarCameraDevice = (deviceId: string, options?: { retry?: boolean }): Promise<YandexDevice> =>
    yandexApi.getQuasarCameraDevice(deviceId, options);
