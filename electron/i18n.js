// Тексты главного процесса (трей, уведомления) на трёх языках.

const STRINGS = {
    ru: {
        trayTooltip: 'Управление умным домом',
        openApp: 'Открыть приложение',
        quit: 'Выход',
        cameraNoVideo: '{name}: нет видео',
        retry: 'Повторить',
        close: 'Закрыть',
        retryAttempt: 'Попытка повторного подключения {attempt} из {max}...',
        unreachable: 'нет связи',
    },
    en: {
        trayTooltip: 'Smart home control',
        openApp: 'Open app',
        quit: 'Quit',
        cameraNoVideo: '{name}: no video',
        retry: 'Retry',
        close: 'Close',
        retryAttempt: 'Reconnecting, attempt {attempt} of {max}...',
        unreachable: 'unreachable',
    },
    de: {
        trayTooltip: 'Smart-Home-Steuerung',
        openApp: 'App öffnen',
        quit: 'Beenden',
        cameraNoVideo: '{name}: kein Video',
        retry: 'Erneut versuchen',
        close: 'Schließen',
        retryAttempt: 'Verbindung wird wiederhergestellt, Versuch {attempt} von {max} …',
        unreachable: 'nicht erreichbar',
    },
};

let current = 'ru';

export const setMainLanguage = (lang) => {
    if (STRINGS[lang]) current = lang;
};

export const tm = (key, vars = {}) => {
    const text = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
};
