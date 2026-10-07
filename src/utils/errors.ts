import type { Translate } from '../i18n/core';

/**
 * Превращает ошибку из главного процесса в понятный текст на выбранном языке.
 * Главный процесс сообщает стабильные коды: ERR_AUTH, ERR_NETWORK, ERR_HTTP <status>,
 * ERR_DEVICE <код Яндекса>, ERR_GROUP_EMPTY, X_TOKEN_REQUIRED.
 */
const CODE_KEYS: Record<string, string> = {
    ERR_AUTH: 'errors.auth',
    ERR_NETWORK: 'errors.network',
    ERR_GROUP_EMPTY: 'errors.groupEmpty',
    X_TOKEN_REQUIRED: 'errors.xTokenRequired',
    CAM_PRIVACY_TOGGLE: 'camera.errors.privacyToggle',
};

export function cleanErrorMessage(error: unknown, t: Translate): string {
    if (!(error instanceof Error)) return t('errors.unknown');

    // Убираем префикс Electron IPC вида:
    // Error invoking remote method 'yandex-api:fetchUserInfo': Error: ...
    const message = error.message.replace(/^Error invoking remote method\s+'[^']+':\s*Error:\s*/i, '').trim();

    if (message in CODE_KEYS) return t(CODE_KEYS[message]);

    const device = /^ERR_DEVICE\s*(.*)$/.exec(message);
    if (device) {
        if (/UNREACHABLE|OFFLINE/i.test(device[1])) return t('errors.deviceUnreachable');
        return t('errors.device', { detail: device[1] || '?' });
    }

    if (/^ERR_HTTP\b/.test(message) || /^\d{3}\s/.test(message) || /error_code/i.test(message)) {
        return t('errors.request');
    }
    return message;
}
